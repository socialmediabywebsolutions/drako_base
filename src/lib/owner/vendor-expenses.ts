import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import {
  deleteDemoVendorExpense,
  getDemoVendorMonthlyAggregates,
  listDemoVendorExpenses,
  upsertDemoVendorExpense,
} from "@/lib/admin/demo-data";
import type {
  DrakoVendorExpense,
  DrakoVendorExpenseFilters,
  DrakoVendorExpenseInput,
  DrakoVendorExpensePeriod,
  DrakoVendorExpenseType,
} from "@/lib/owner/vendor-types";

export type VendorExpensesMode = "d1" | "demo";

export type VendorExpensesContext = {
  tenantId: string;
  mode: VendorExpensesMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

export class VendorExpensesContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VendorExpensesContextError";
  }
}

const TABLE = "drako_vendor_expenses";

const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

type VendorExpenseRow = {
  id: string;
  label: string;
  type: string;
  amount: number;
  currency: string;
  period: string;
  from_date: string;
  to_date: string | null;
  vertical_id: string | null;
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

function shouldFallbackToDemo(error: unknown, ctx: VendorExpensesContext): boolean {
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

function mapRowToDrakoVendorExpense(row: VendorExpenseRow): DrakoVendorExpense {
  return {
    id: row.id,
    label: row.label,
    type: row.type as DrakoVendorExpenseType,
    amount: row.amount,
    currency: row.currency,
    period: row.period as DrakoVendorExpensePeriod,
    fromDate: row.from_date,
    toDate: row.to_date ?? null,
    verticalId: row.vertical_id ?? null,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function queryAllWithCtx<T>(ctx: VendorExpensesContext, sql: string, ...params: unknown[]): Promise<T[]> {
  if (ctx.mode !== "d1") return [];
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return [];
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all<T>();
  return res.results ?? [];
}

async function runWithCtx(ctx: VendorExpensesContext, sql: string, ...params: unknown[]): Promise<boolean> {
  if (ctx.mode !== "d1") return false;
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return false;
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.run();
  return Boolean(res?.success);
}

function demoTenantId(ctx: VendorExpensesContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

function mapDemoVendorExpense(row: {
  id: string;
  label: string;
  type: string;
  amount: number;
  currency: string;
  period: string;
  from_date: string;
  to_date: string | null;
  vertical_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}): DrakoVendorExpense {
  return {
    id: row.id,
    label: row.label,
    type: row.type as DrakoVendorExpenseType,
    amount: row.amount,
    currency: row.currency,
    period: row.period as DrakoVendorExpensePeriod,
    fromDate: row.from_date,
    toDate: row.to_date ?? null,
    verticalId: row.vertical_id ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function resolveVendorExpensesContext({
  tenantId,
  env,
}: {
  tenantId: string;
  env?: DracoEnv | null;
}): Promise<VendorExpensesContext> {
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
    throw new VendorExpensesContextError("Vendor expenses are not enabled for this tenant.");
  }

  return {
    tenantId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
    env: resolveEnvOverride(env),
  };
}

export async function listVendorExpenses(
  ctx: VendorExpensesContext,
  filter?: DrakoVendorExpenseFilters
): Promise<DrakoVendorExpense[]> {
  if (ctx.mode === "d1" && ctx.db) {
    try {
      let query = `SELECT * FROM ${TABLE}`;
      const params: Array<string | number | null> = [];
      const conditions: string[] = [];

      if (filter) {
        if (filter.from) {
          conditions.push("from_date >= ?");
          params.push(filter.from);
        }
        if (filter.to) {
          conditions.push("(to_date IS NULL OR to_date <= ?)");
          params.push(filter.to);
        }
        if (filter.type) {
          conditions.push("type = ?");
          params.push(filter.type);
        }
        if (filter.period) {
          conditions.push("period = ?");
          params.push(filter.period);
        }
        if (filter.verticalId !== undefined) {
          if (filter.verticalId === null) {
            conditions.push("vertical_id IS NULL");
          } else {
            conditions.push("vertical_id = ?");
            params.push(filter.verticalId);
          }
        }
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      query += " ORDER BY from_date DESC, created_at DESC";

      const rows = await queryAllWithCtx<VendorExpenseRow>(ctx, query, ...params);
      return rows.map(mapRowToDrakoVendorExpense);
    } catch (error) {
      if (shouldFallbackToDemo(error, ctx)) {
        const demoRows = listDemoVendorExpenses(demoTenantId(ctx), filter);
        return demoRows.map(mapDemoVendorExpense);
      }
      throw error;
    }
  }

  const demoRows = listDemoVendorExpenses(demoTenantId(ctx), filter);
  return demoRows.map(mapDemoVendorExpense);
}

export async function upsertVendorExpense(
  ctx: VendorExpensesContext,
  input: DrakoVendorExpenseInput
): Promise<DrakoVendorExpense> {
  const now = new Date().toISOString();
  
  if (ctx.mode === "d1" && ctx.db) {
    try {
      const id = input.id?.trim() ?? generateUuid();
      const metadata = serializeMetadata(input.metadata);
      const verticalId = input.verticalId ?? null;
      const toDate = input.toDate ?? null;
      
      await runWithCtx(
        ctx,
        `INSERT INTO ${TABLE} (
          id, label, type, amount, currency, period, from_date, to_date, vertical_id, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          label = excluded.label,
          type = excluded.type,
          amount = excluded.amount,
          currency = excluded.currency,
          period = excluded.period,
          from_date = excluded.from_date,
          to_date = excluded.to_date,
          vertical_id = excluded.vertical_id,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at`,
        id,
        input.label,
        input.type,
        input.amount,
        input.currency,
        input.period,
        input.fromDate,
        toDate,
        verticalId,
        metadata,
        now,
        now,
      );

      const result = await queryAllWithCtx<VendorExpenseRow>(ctx, `SELECT * FROM ${TABLE} WHERE id = ?`, id);

      if (!result.length) {
        throw new Error("Failed to retrieve upserted expense");
      }

      return mapRowToDrakoVendorExpense(result[0]);
    } catch (error) {
      if (shouldFallbackToDemo(error, ctx)) {
        const demoRecord = upsertDemoVendorExpense(demoTenantId(ctx), {
          id: input.id,
          label: input.label,
          type: input.type,
          amount: input.amount,
          currency: input.currency,
          period: input.period,
          from_date: input.fromDate,
          to_date: input.toDate ?? null,
          vertical_id: input.verticalId ?? null,
          metadata: input.metadata ?? null,
        });
        return mapDemoVendorExpense(demoRecord);
      }
      throw error;
    }
  }

  const demoRecord = upsertDemoVendorExpense(demoTenantId(ctx), {
    id: input.id,
    label: input.label,
    type: input.type,
    amount: input.amount,
    currency: input.currency,
    period: input.period,
    from_date: input.fromDate,
    to_date: input.toDate ?? null,
    vertical_id: input.verticalId ?? null,
    metadata: input.metadata ?? null,
  });
  return mapDemoVendorExpense(demoRecord);
}

export async function deleteVendorExpense(
  ctx: VendorExpensesContext,
  id: string
): Promise<void> {
  if (ctx.mode === "d1" && ctx.db) {
    try {
      await runWithCtx(ctx, `DELETE FROM ${TABLE} WHERE id = ?`, id);
      return;
    } catch (error) {
      if (!shouldFallbackToDemo(error, ctx)) throw error;
    }
  }
  deleteDemoVendorExpense(demoTenantId(ctx), id);
}

export type VendorMonthlyAggregate = {
  month: string; // YYYY-MM format
  type: DrakoVendorExpenseType;
  verticalId: string | null;
  total: number;
};

export type VendorMonthlyAggregates = {
  byType: Array<{ month: string; type: DrakoVendorExpenseType; total: number }>;
  byVertical: Array<{ month: string; verticalId: string | null; total: number }>;
};

export async function getVendorMonthlyAggregates(
  ctx: VendorExpensesContext,
  params: { from: string; to: string }
): Promise<VendorMonthlyAggregates> {
  if (ctx.mode === "demo") {
    return getDemoVendorMonthlyAggregates(demoTenantId(ctx), params);
  }

  const expenses = await listVendorExpenses(ctx, {
    from: `${params.from}-01`,
    to: `${params.to}-31`,
  });

  const byType = new Map<string, Map<DrakoVendorExpenseType, number>>();
  const byVertical = new Map<string, Map<string | null, number>>();

  for (const expense of expenses) {
    const month = expense.fromDate.slice(0, 7); // YYYY-MM format
    
    // Calculate monthly amount
    let monthlyAmount = expense.amount;
    if (expense.period === "YEARLY") {
      monthlyAmount = expense.amount / 12;
    } else if (expense.period === "ONE_OFF") {
      // For one-off expenses, we'll attribute the full amount to the month of fromDate
      monthlyAmount = expense.amount;
    }

    // Group by type
    if (!byType.has(month)) {
      byType.set(month, new Map());
    }
    const typeMap = byType.get(month)!;
    typeMap.set(expense.type, (typeMap.get(expense.type) || 0) + monthlyAmount);

    // Group by vertical
    if (!byVertical.has(month)) {
      byVertical.set(month, new Map());
    }
    const verticalMap = byVertical.get(month)!;
    const verticalId = expense.verticalId ?? null;
    verticalMap.set(verticalId, (verticalMap.get(verticalId) || 0) + monthlyAmount);
  }

  // Convert maps to arrays
  const byTypeArray: VendorMonthlyAggregates['byType'] = [];
  for (const [month, typeMap] of byType) {
    for (const [type, total] of typeMap) {
      byTypeArray.push({ month, type, total });
    }
  }

  const byVerticalArray: VendorMonthlyAggregates["byVertical"] = [];
  for (const [month, verticalMap] of byVertical) {
    for (const [verticalId, total] of verticalMap) {
      byVerticalArray.push({ month, verticalId, total });
    }
  }

  return {
    byType: byTypeArray,
    byVertical: byVerticalArray,
  };
}
