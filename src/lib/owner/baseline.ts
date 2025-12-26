import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import {
  deleteDemoBaselineNeed,
  listDemoBaselineNeeds,
  upsertDemoBaselineNeed,
} from "@/lib/admin/demo-data";
import type { DrakoBaselineNeed, DrakoBaselineNeedCategory, DrakoBaselineSnapshot } from "@/lib/owner/vendor-types";

export type BaselineContextMode = "d1" | "demo";

export type BaselineContext = {
  tenantId: string;
  mode: BaselineContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

export class BaselineContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaselineContextError";
  }
}

const TABLE = "drako_owner_baseline_needs";
const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

type BaselineRow = {
  id: string;
  tenant_id: string;
  label: string;
  category: string;
  amount_monthly: number;
  currency: string;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

function resolveEnvOverride(envOverride?: DracoEnv | null): DracoEnv | null {
  if (envOverride) return envOverride;
  return resolveEnv();
}

function hasDatabase(envOverride?: DracoEnv | null): boolean {
  return Boolean(resolveEnvOverride(envOverride)?.DRACO_DB);
}

function isDemoFeatureEnabled(tenantId: string, envOverride?: DracoEnv | null): boolean {
  if (tenantId === DEMO_TENANT_ID) return true;
  const runtimeEnv = resolveEnvOverride(envOverride);
  const flag = runtimeEnv?.DRAKO_DEMO_MODE ?? process.env.DRAKO_DEMO_MODE;
  return typeof flag === "string" && flag.toLowerCase() === "true";
}

function shouldFallbackToDemo(error: unknown, ctx: BaselineContext): boolean {
  if (ctx.mode !== "d1" || !ctx.allowDemoFallback) return false;
  const message = (error instanceof Error ? error.message : `${error ?? ""}`).toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function serializeMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

function generateUuid(): string {
  const globalCrypto = typeof globalThis !== "undefined" ? (globalThis.crypto as { randomUUID?: () => string } | undefined) : undefined;
  if (globalCrypto?.randomUUID) {
    try {
      return globalCrypto.randomUUID();
    } catch {
      // ignore and fallback
    }
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function demoTenantId(ctx: BaselineContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

function mapRow(row: BaselineRow): DrakoBaselineNeed {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    label: row.label,
    category: row.category as DrakoBaselineNeedCategory,
    amountMonthly: row.amount_monthly,
    currency: row.currency,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDemoRow(row: {
  id: string;
  tenant_id: string;
  label: string;
  category: DrakoBaselineNeedCategory;
  amount_monthly: number;
  currency: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}): DrakoBaselineNeed {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    label: row.label,
    category: row.category,
    amountMonthly: row.amount_monthly,
    currency: row.currency,
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function queryAllWithCtx<T>(ctx: BaselineContext, sql: string, ...params: unknown[]): Promise<T[]> {
  if (ctx.mode !== "d1") return [];
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return [];
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all<T>();
  return res.results ?? [];
}

async function runWithCtx(ctx: BaselineContext, sql: string, ...params: unknown[]): Promise<boolean> {
  if (ctx.mode !== "d1") return false;
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return false;
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.run();
  return Boolean(res?.success);
}

export async function resolveBaselineContext({
  tenantId,
  env,
}: {
  tenantId: string;
  env?: DracoEnv | null;
}): Promise<BaselineContext> {
  const demoEnabled = isDemoFeatureEnabled(tenantId, env);

  if (hasDatabase(env)) {
    const runtimeEnv = resolveEnvOverride(env);
    return {
      tenantId,
      mode: "d1",
      allowDemoFallback: demoEnabled,
      demoTenantId: demoEnabled ? DEMO_TENANT_ID : undefined,
      db: runtimeEnv?.DRACO_DB,
      env: runtimeEnv,
    };
  }

  if (!demoEnabled) {
    throw new BaselineContextError("Baseline needs are not enabled for this tenant.");
  }

  return {
    tenantId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
    env: resolveEnvOverride(env),
  };
}

export async function listBaselineNeeds(ctx: BaselineContext): Promise<DrakoBaselineNeed[]> {
  if (ctx.mode === "d1") {
    try {
      const rows = await queryAllWithCtx<BaselineRow>(
        ctx,
        `SELECT * FROM ${TABLE} WHERE tenant_id = ? ORDER BY created_at ASC`,
        ctx.tenantId,
      );
      return rows.map(mapRow);
    } catch (error) {
      if (shouldFallbackToDemo(error, ctx)) {
        return listDemoBaselineNeeds(demoTenantId(ctx)).map(mapDemoRow);
      }
      throw error;
    }
  }

  return listDemoBaselineNeeds(demoTenantId(ctx)).map(mapDemoRow);
}

export async function upsertBaselineNeed(
  ctx: BaselineContext,
  input: Omit<DrakoBaselineNeed, "createdAt" | "updatedAt" | "tenantId"> & { tenantId?: string },
): Promise<DrakoBaselineNeed> {
  const now = new Date().toISOString();
  const tenantId = input.tenantId ?? ctx.tenantId;
  if (ctx.mode === "d1") {
    try {
      const id = input.id?.trim() ?? generateUuid();
      const metadata = serializeMetadata(input.metadata);
      await runWithCtx(
        ctx,
        `INSERT INTO ${TABLE} (
          id, tenant_id, label, category, amount_monthly, currency, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          label = excluded.label,
          category = excluded.category,
          amount_monthly = excluded.amount_monthly,
          currency = excluded.currency,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at`,
        id,
        tenantId,
        input.label,
        input.category,
        input.amountMonthly,
        input.currency,
        metadata,
        now,
        now,
      );
      const rows = await queryAllWithCtx<BaselineRow>(ctx, `SELECT * FROM ${TABLE} WHERE id = ?`, id);
      if (!rows.length) {
        throw new Error("Failed to retrieve upserted baseline need");
      }
      return mapRow(rows[0]);
    } catch (error) {
      if (shouldFallbackToDemo(error, ctx)) {
        return mapDemoRow(
          upsertDemoBaselineNeed(demoTenantId(ctx), {
            id: input.id,
            label: input.label,
            category: input.category,
            amount_monthly: input.amountMonthly,
            currency: input.currency,
            metadata: input.metadata ?? null,
          }),
        );
      }
      throw error;
    }
  }

  return mapDemoRow(
    upsertDemoBaselineNeed(demoTenantId(ctx), {
      id: input.id,
      label: input.label,
      category: input.category,
      amount_monthly: input.amountMonthly,
      currency: input.currency,
      metadata: input.metadata ?? null,
    }),
  );
}

export async function deleteBaselineNeed(ctx: BaselineContext, id: string): Promise<void> {
  if (ctx.mode === "d1") {
    try {
      await runWithCtx(ctx, `DELETE FROM ${TABLE} WHERE id = ?`, id);
      return;
    } catch (error) {
      if (!shouldFallbackToDemo(error, ctx)) throw error;
    }
  }
  deleteDemoBaselineNeed(demoTenantId(ctx), id);
}

export async function getBaselineSnapshot(params: { tenantId: string; env?: DracoEnv | null }): Promise<DrakoBaselineSnapshot> {
  const ctx = await resolveBaselineContext({ tenantId: params.tenantId, env: params.env });
  const items = await listBaselineNeeds(ctx);
  const lifeTotalMonthly = items.filter((item) => item.category === "LIFE").reduce((acc, item) => acc + item.amountMonthly, 0);
  const workTotalMonthly = items.filter((item) => item.category === "WORK").reduce((acc, item) => acc + item.amountMonthly, 0);
  const baselineTotalMonthly = lifeTotalMonthly + workTotalMonthly;
  return {
    lifeTotalMonthly,
    workTotalMonthly,
    baselineTotalMonthly,
    items,
  };
}
