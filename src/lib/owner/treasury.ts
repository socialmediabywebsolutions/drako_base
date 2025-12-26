import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import {
  getDemoOwner,
  listDemoTreasuryAccounts,
  listDemoTreasuryMovements,
  registerDemoTreasuryMovement,
} from "@/lib/admin/demo-data";
import { queryAll } from "@/lib/db";
import { buildOwnerAccountingSnapshot } from "@/lib/owner/accounting";
import { getDrakoVendorAccountingSnapshot } from "@/lib/owner/vendor-accounting";
import type { DrakoTreasuryAccountBalance, DrakoTreasuryAccountType, DrakoTreasurySnapshot } from "@/lib/owner/vendor-types";

export type TreasuryContextMode = "d1" | "demo";

export type TreasuryContext = {
  tenantId: string;
  mode: TreasuryContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

export class TreasuryContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TreasuryContextError";
  }
}

const ACCOUNTS_TABLE = "drako_treasury_accounts";
const MOVEMENTS_TABLE = "drako_treasury_movements";
const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];
const DEFAULT_TAX_RESERVE_PERCENT = 0.3;

type TreasuryAccountRow = {
  id: string;
  tenant_id: string;
  label: string;
  type: DrakoTreasuryAccountType;
  currency: string;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type TreasuryMovementRow = {
  id: string;
  tenant_id: string;
  account_id: string;
  kind: "INFLOW" | "OUTFLOW";
  label: string;
  amount: number;
  currency: string;
  source: "SaaS_RENTAL" | "TAX_PAYMENT" | "IA_TOOLS" | "INFRA" | "TRANSFER" | "OTHER";
  saas_id: string | null;
  period: string | null;
  occurred_at: string;
  metadata: string | Record<string, unknown> | null;
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

function shouldFallbackToDemo(error: unknown, ctx: TreasuryContext): boolean {
  if (ctx.mode !== "d1" || !ctx.allowDemoFallback) return false;
  const message = (error instanceof Error ? error.message : `${error ?? ""}`).toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
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

function demoTenantId(ctx: TreasuryContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

async function queryAllWithCtx<T>(ctx: TreasuryContext, sql: string, ...params: unknown[]): Promise<T[]> {
  if (ctx.mode !== "d1") return [];
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return [];
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all<T>();
  return res.results ?? [];
}

async function runWithCtx(ctx: TreasuryContext, sql: string, ...params: unknown[]): Promise<boolean> {
  if (ctx.mode !== "d1") return false;
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return false;
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.run();
  return Boolean(res?.success);
}

async function resolveOwnerId(tenantId: string): Promise<string | null> {
  const rows = await queryAll<{ id: string }>("SELECT id FROM owners WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1", tenantId);
  if (rows[0]?.id) return rows[0].id;
  return getDemoOwner(tenantId)?.id ?? null;
}

function mapAccountRow(row: TreasuryAccountRow): DrakoTreasuryAccountBalance {
  return {
    accountId: row.id,
    label: row.label,
    type: row.type,
    balance: 0,
  };
}

function mapDemoAccountRow(row: {
  id: string;
  label: string;
  type: DrakoTreasuryAccountType;
}): DrakoTreasuryAccountBalance {
  return {
    accountId: row.id,
    label: row.label,
    type: row.type,
    balance: 0,
  };
}

export async function resolveTreasuryContext({
  tenantId,
  env,
}: {
  tenantId: string;
  env?: DracoEnv | null;
}): Promise<TreasuryContext> {
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
    throw new TreasuryContextError("Treasury is not enabled for this tenant.");
  }

  return {
    tenantId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
    env: resolveEnvOverride(env),
  };
}

export async function listDrakoTreasuryAccounts(ctx: TreasuryContext): Promise<DrakoTreasuryAccountBalance[]> {
  if (ctx.mode === "d1") {
    try {
      const rows = await queryAllWithCtx<TreasuryAccountRow>(
        ctx,
        `SELECT * FROM ${ACCOUNTS_TABLE} WHERE tenant_id = ? ORDER BY created_at ASC`,
        ctx.tenantId,
      );
      return rows.map(mapAccountRow);
    } catch (error) {
      if (shouldFallbackToDemo(error, ctx)) {
        return listDemoTreasuryAccounts(demoTenantId(ctx)).map(mapDemoAccountRow);
      }
      throw error;
    }
  }

  return listDemoTreasuryAccounts(demoTenantId(ctx)).map(mapDemoAccountRow);
}

export async function listDrakoTreasuryMovements(
  ctx: TreasuryContext,
  params?: { period?: string },
): Promise<TreasuryMovementRow[]> {
  if (ctx.mode === "d1") {
    try {
      const rows = await queryAllWithCtx<TreasuryMovementRow>(
        ctx,
        `SELECT * FROM ${MOVEMENTS_TABLE} WHERE tenant_id = ?${params?.period ? " AND period = ?" : ""} ORDER BY occurred_at DESC`,
        ...(params?.period ? [ctx.tenantId, params.period] : [ctx.tenantId]),
      );
      return rows;
    } catch (error) {
      if (shouldFallbackToDemo(error, ctx)) {
        return listDemoTreasuryMovements(demoTenantId(ctx), params);
      }
      throw error;
    }
  }

  return listDemoTreasuryMovements(demoTenantId(ctx), params);
}

export async function registerTreasuryMovement(
  ctx: TreasuryContext,
  input: {
    id?: string;
    accountId: string;
    kind: "INFLOW" | "OUTFLOW";
    label: string;
    amount: number;
    currency: string;
    source: TreasuryMovementRow["source"];
    saasId?: string | null;
    period?: string | null;
    occurredAt: string;
    metadata?: Record<string, unknown> | null;
  },
): Promise<TreasuryMovementRow> {
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? generateUuid();
  const metadata = serializeMetadata(input.metadata);
  const payload: TreasuryMovementRow = {
    id,
    tenant_id: ctx.tenantId,
    account_id: input.accountId,
    kind: input.kind,
    label: input.label,
    amount: input.amount,
    currency: input.currency,
    source: input.source,
    saas_id: input.saasId ?? null,
    period: input.period ?? null,
    occurred_at: input.occurredAt,
    metadata,
    created_at: now,
    updated_at: now,
  };

  if (ctx.mode === "d1") {
    try {
      await runWithCtx(
        ctx,
        `INSERT INTO ${MOVEMENTS_TABLE} (
          id, tenant_id, account_id, kind, label, amount, currency, source, saas_id, period, occurred_at, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          account_id = excluded.account_id,
          kind = excluded.kind,
          label = excluded.label,
          amount = excluded.amount,
          currency = excluded.currency,
          source = excluded.source,
          saas_id = excluded.saas_id,
          period = excluded.period,
          occurred_at = excluded.occurred_at,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at`,
        payload.id,
        payload.tenant_id,
        payload.account_id,
        payload.kind,
        payload.label,
        payload.amount,
        payload.currency,
        payload.source,
        payload.saas_id,
        payload.period,
        payload.occurred_at,
        payload.metadata,
        payload.created_at,
        payload.updated_at,
      );
      const rows = await queryAllWithCtx<TreasuryMovementRow>(ctx, `SELECT * FROM ${MOVEMENTS_TABLE} WHERE id = ?`, payload.id);
      if (rows[0]) return rows[0];
      return payload;
    } catch (error) {
      if (shouldFallbackToDemo(error, ctx)) {
        return registerDemoTreasuryMovement(demoTenantId(ctx), {
          id: input.id,
          account_id: input.accountId,
          kind: input.kind,
          label: input.label,
          amount: input.amount,
          currency: input.currency,
          source: input.source,
          saas_id: input.saasId ?? null,
          period: input.period ?? null,
          occurred_at: input.occurredAt,
          metadata: input.metadata ?? null,
        });
      }
      throw error;
    }
  }

  return registerDemoTreasuryMovement(demoTenantId(ctx), {
    id: input.id,
    account_id: input.accountId,
    kind: input.kind,
    label: input.label,
    amount: input.amount,
    currency: input.currency,
    source: input.source,
    saas_id: input.saasId ?? null,
    period: input.period ?? null,
    occurred_at: input.occurredAt,
    metadata: input.metadata ?? null,
  });
}

function sumBalances(
  accounts: DrakoTreasuryAccountBalance[],
  movements: TreasuryMovementRow[],
): DrakoTreasuryAccountBalance[] {
  const movementByAccount = new Map<string, number>();
  for (const movement of movements) {
    const sign = movement.kind === "INFLOW" ? 1 : -1;
    movementByAccount.set(movement.account_id, (movementByAccount.get(movement.account_id) ?? 0) + sign * movement.amount);
  }
  return accounts.map((account) => ({
    ...account,
    balance: movementByAccount.get(account.accountId) ?? 0,
  }));
}

function extractBalance(accounts: DrakoTreasuryAccountBalance[], type: DrakoTreasuryAccountType): number {
  return accounts.filter((account) => account.type === type).reduce((acc, account) => acc + account.balance, 0);
}

export async function getDrakoTreasurySnapshot(params: {
  tenantId: string;
  ownerId?: string | null;
  env?: DracoEnv | null;
}): Promise<DrakoTreasurySnapshot> {
  const ctx = await resolveTreasuryContext({ tenantId: params.tenantId, env: params.env });
  const [accounts, movements] = await Promise.all([
    listDrakoTreasuryAccounts(ctx),
    listDrakoTreasuryMovements(ctx),
  ]);

  const accountsWithBalance = sumBalances(accounts, movements);
  const totalBalance = accountsWithBalance.reduce((acc, account) => acc + account.balance, 0);
  const taxReserveBalance = extractBalance(accountsWithBalance, "TAX_RESERVE");
  const infraReserveBalance = extractBalance(accountsWithBalance, "INFRA_RESERVE");
  const aiReserveBalance = extractBalance(accountsWithBalance, "AI_RESERVE");
  const personalSpendingBalance = extractBalance(accountsWithBalance, "PERSONAL_SPENDING");

  const ownerId = params.ownerId ?? (await resolveOwnerId(params.tenantId));
  const accounting = ownerId
    ? await buildOwnerAccountingSnapshot({ tenantId: params.tenantId, ownerId })
    : null;
  const vendorSnapshot = ownerId
    ? await getDrakoVendorAccountingSnapshot({ tenantId: params.tenantId, ownerId })
    : null;

  const taxSummary = accounting?.taxSummary;
  const taxFromSummary = taxSummary?.totalVatDueAllSaas ?? 0;
  const taxableMonthly = accounting?.totalSubscriptionMRR ?? 0;
  const recommendedTaxReserveThisQuarter = Math.max(
    taxFromSummary,
    taxableMonthly * DEFAULT_TAX_RESERVE_PERCENT * 3,
  );

  const infraMonthly = vendorSnapshot?.vendorExpensesByType.find((item) => item.type === "INFRA")?.amount ?? 0;
  const aiMonthly = vendorSnapshot?.vendorExpensesByType.find((item) => item.type === "AI")?.amount ?? 0;

  const recommendedInfraReserveThisMonth = infraMonthly;
  const recommendedAiReserveThisMonth = aiMonthly;

  const taxReserveGap = Math.max(0, recommendedTaxReserveThisQuarter - taxReserveBalance);
  const infraReserveGap = Math.max(0, recommendedInfraReserveThisMonth - infraReserveBalance);
  const aiReserveGap = Math.max(0, recommendedAiReserveThisMonth - aiReserveBalance);

  return {
    accounts: accountsWithBalance,
    totalBalance,
    taxReserveBalance,
    infraReserveBalance,
    aiReserveBalance,
    personalSpendingBalance,
    recommendedTaxReserveThisQuarter,
    recommendedInfraReserveThisMonth,
    recommendedAiReserveThisMonth,
    taxReserveGap,
    infraReserveGap,
    aiReserveGap,
  };
}
