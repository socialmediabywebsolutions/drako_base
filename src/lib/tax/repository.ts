import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { queryAll, run } from "@/lib/db";
import {
  getDemoTaxProfileForSaas,
  getDemoTaxPeriodByKey,
  listDemoTaxPeriodsForSaas,
  upsertDemoTaxProfile,
  upsertDemoTaxPeriod,
} from "@/lib/admin/demo-data";
import type { DemoSaasTaxPeriod, DemoSaasTaxProfile } from "@/lib/admin/demo-data";
import type { SaasTaxPeriod, SaasTaxPeriodStatus, SaasTaxPeriodType, SaasTaxProfile } from "@/lib/tax/types";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";

export type TaxContextMode = "d1" | "demo";

export type TaxContext = {
  tenantId: string;
  saasId: string | null;
  mode: TaxContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

export class TaxContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxContextError";
  }
}

type TaxProfileRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  country: string;
  region: string | null;
  regime: string;
  default_vat_rate: number;
  reduced_vat_rate: number | null;
  super_reduced_vat_rate: number | null;
  uses_withholding: number;
  withholding_rate: number;
  income_tax_mode: string;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type TaxPeriodRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  period_type: string;
  period_key: string;
  start_date: string;
  end_date: string;
  status: string;
  estimated_revenue: number;
  estimated_expenses: number;
  vat_collected: number;
  vat_paid: number;
  vat_due: number;
  income_tax_base: number;
  income_tax_due: number;
  notes: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

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

function shouldFallbackToDemo(error: unknown, ctx: TaxContext): boolean {
  if (ctx.mode !== "d1" || !ctx.allowDemoFallback) return false;
  const message = (error instanceof Error ? error.message : `${error ?? ""}`).toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function generateUuid(): string {
  const globalCrypto = typeof globalThis !== "undefined" ? (globalThis.crypto as { randomUUID?: () => string } | undefined) : undefined;
  if (globalCrypto?.randomUUID) {
    try {
      return globalCrypto.randomUUID();
    } catch {
      // ignore
    }
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function demoTenantId(ctx: TaxContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

function requireSaasId(ctx: TaxContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) throw new TaxContextError("saasId is required for tax.");
  return saasId;
}

function mapTaxProfileRow(row: TaxProfileRow): SaasTaxProfile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    country: row.country,
    region: row.region,
    regime: row.regime,
    defaultVatRate: row.default_vat_rate,
    reducedVatRate: row.reduced_vat_rate,
    superReducedVatRate: row.super_reduced_vat_rate,
    usesWithholding: row.uses_withholding === 1,
    withholdingRate: row.withholding_rate,
    incomeTaxMode: row.income_tax_mode,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTaxPeriodRow(row: TaxPeriodRow): SaasTaxPeriod {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    periodType: row.period_type as SaasTaxPeriodType,
    periodKey: row.period_key,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as SaasTaxPeriodStatus,
    estimatedRevenue: row.estimated_revenue,
    estimatedExpenses: row.estimated_expenses,
    vatCollected: row.vat_collected,
    vatPaid: row.vat_paid,
    vatDue: row.vat_due,
    incomeTaxBase: row.income_tax_base,
    incomeTaxDue: row.income_tax_due,
    notes: row.notes,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function demoProfileToRow(record: DemoSaasTaxProfile): TaxProfileRow {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    saas_id: record.saas_id,
    country: record.country,
    region: record.region ?? null,
    regime: record.regime,
    default_vat_rate: record.default_vat_rate,
    reduced_vat_rate: record.reduced_vat_rate ?? null,
    super_reduced_vat_rate: record.super_reduced_vat_rate ?? null,
    uses_withholding: record.uses_withholding,
    withholding_rate: record.withholding_rate,
    income_tax_mode: record.income_tax_mode,
    metadata: record.metadata ?? null,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function demoPeriodToRow(record: DemoSaasTaxPeriod): TaxPeriodRow {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    saas_id: record.saas_id,
    period_type: record.period_type,
    period_key: record.period_key,
    start_date: record.start_date,
    end_date: record.end_date,
    status: record.status,
    estimated_revenue: record.estimated_revenue,
    estimated_expenses: record.estimated_expenses,
    vat_collected: record.vat_collected,
    vat_paid: record.vat_paid,
    vat_due: record.vat_due,
    income_tax_base: record.income_tax_base,
    income_tax_due: record.income_tax_due,
    notes: record.notes ?? null,
    metadata: record.metadata ?? null,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export async function resolveTaxContext({
  tenantId,
  saasId,
  env,
}: {
  tenantId: string;
  saasId?: string | null;
  env?: DracoEnv | null;
}): Promise<TaxContext> {
  const normalizedSaasId = saasId?.trim() ?? null;
  const demoEnabled = isDemoFeatureEnabled(tenantId, env);

  if (hasDatabase(env)) {
    const runtimeEnv = resolveEnvOverride(env);
    return {
      tenantId,
      saasId: normalizedSaasId,
      mode: "d1",
      allowDemoFallback: demoEnabled,
      demoTenantId: demoEnabled ? DEMO_TENANT_ID : undefined,
      db: runtimeEnv?.DRACO_DB,
      env,
    };
  }

  if (!demoEnabled) {
    throw new TaxContextError("Tax module is not enabled for this tenant.");
  }

  return {
    tenantId,
    saasId: normalizedSaasId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
    env,
  };
}

export async function getSaasTaxProfile(ctx: TaxContext): Promise<SaasTaxProfile | null> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const record = getDemoTaxProfileForSaas(demoTenantId(ctx), saasId);
    return record ? mapTaxProfileRow(demoProfileToRow(record)) : null;
  }
  try {
    const rows = await queryAll<TaxProfileRow>(
      `SELECT * FROM saas_tax_profiles WHERE tenant_id = ? AND saas_id = ? LIMIT 1`,
      ctx.tenantId,
      saasId,
    );
    return rows[0] ? mapTaxProfileRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoTaxProfileForSaas(demoTenantId(ctx), saasId);
      return record ? mapTaxProfileRow(demoProfileToRow(record)) : null;
    }
    throw error;
  }
}

export async function upsertSaasTaxProfile(
  ctx: TaxContext,
  input: Omit<SaasTaxProfile, "id" | "tenantId" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<SaasTaxProfile> {
  const saasId = requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? generateUuid();
  const payload: TaxProfileRow = {
    id,
    tenant_id: ctx.tenantId,
    saas_id: saasId,
    country: input.country,
    region: input.region ?? null,
    regime: input.regime,
    default_vat_rate: input.defaultVatRate,
    reduced_vat_rate: input.reducedVatRate ?? null,
    super_reduced_vat_rate: input.superReducedVatRate ?? null,
    uses_withholding: input.usesWithholding ? 1 : 0,
    withholding_rate: input.withholdingRate,
    income_tax_mode: input.incomeTaxMode,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    created_at: now,
    updated_at: now,
  };

  if (ctx.mode === "demo") {
    const record = upsertDemoTaxProfile(demoTenantId(ctx), payload);
    return mapTaxProfileRow(demoProfileToRow(record));
  }

  try {
    await run(
      `INSERT INTO saas_tax_profiles (
         id, tenant_id, saas_id, country, region, regime, default_vat_rate, reduced_vat_rate, super_reduced_vat_rate,
         uses_withholding, withholding_rate, income_tax_mode, metadata, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
         country = excluded.country,
         region = excluded.region,
         regime = excluded.regime,
         default_vat_rate = excluded.default_vat_rate,
         reduced_vat_rate = excluded.reduced_vat_rate,
         super_reduced_vat_rate = excluded.super_reduced_vat_rate,
         uses_withholding = excluded.uses_withholding,
         withholding_rate = excluded.withholding_rate,
         income_tax_mode = excluded.income_tax_mode,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at`,
      payload.id,
      payload.tenant_id,
      payload.saas_id,
      payload.country,
      payload.region,
      payload.regime,
      payload.default_vat_rate,
      payload.reduced_vat_rate,
      payload.super_reduced_vat_rate,
      payload.uses_withholding,
      payload.withholding_rate,
      payload.income_tax_mode,
      payload.metadata,
      payload.created_at,
      payload.updated_at,
    );
    const record = await getSaasTaxProfile(ctx);
    if (!record) throw new Error("Tax profile write failed");
    return record;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoTaxProfile(demoTenantId(ctx), payload);
      return mapTaxProfileRow(demoProfileToRow(record));
    }
    throw error;
  }
}

export async function getOrCreateTaxPeriod(
  ctx: TaxContext,
  input: { periodType: SaasTaxPeriodType; periodKey: string; startDate: string; endDate: string },
): Promise<SaasTaxPeriod> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const existing = getDemoTaxPeriodByKey(demoTenantId(ctx), saasId, input.periodType, input.periodKey);
    if (existing) return mapTaxPeriodRow(demoPeriodToRow(existing));
    const record = upsertDemoTaxPeriod(demoTenantId(ctx), {
      id: generateUuid(),
      saas_id: saasId,
      period_type: input.periodType,
      period_key: input.periodKey,
      start_date: input.startDate,
      end_date: input.endDate,
      status: "OPEN",
      estimated_revenue: 0,
      estimated_expenses: 0,
      vat_collected: 0,
      vat_paid: 0,
      vat_due: 0,
      income_tax_base: 0,
      income_tax_due: 0,
      notes: null,
      metadata: null,
    });
    return mapTaxPeriodRow(demoPeriodToRow(record));
  }
  try {
    const existing = await queryAll<TaxPeriodRow>(
      `SELECT * FROM saas_tax_periods WHERE tenant_id = ? AND saas_id = ? AND period_type = ? AND period_key = ? LIMIT 1`,
      ctx.tenantId,
      saasId,
      input.periodType,
      input.periodKey,
    );
    if (existing[0]) return mapTaxPeriodRow(existing[0]);
    const id = generateUuid();
    const now = new Date().toISOString();
    await run(
      `INSERT INTO saas_tax_periods (
        id, tenant_id, saas_id, period_type, period_key, start_date, end_date, status,
        estimated_revenue, estimated_expenses, vat_collected, vat_paid, vat_due, income_tax_base, income_tax_due,
        notes, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      ctx.tenantId,
      saasId,
      input.periodType,
      input.periodKey,
      input.startDate,
      input.endDate,
      "OPEN",
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      now,
      now,
    );
    const rows = await queryAll<TaxPeriodRow>(
      `SELECT * FROM saas_tax_periods WHERE tenant_id = ? AND id = ? LIMIT 1`,
      ctx.tenantId,
      id,
    );
    return mapTaxPeriodRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoTaxPeriod(demoTenantId(ctx), {
        id: generateUuid(),
        saas_id: saasId,
        period_type: input.periodType,
        period_key: input.periodKey,
        start_date: input.startDate,
        end_date: input.endDate,
        status: "OPEN",
        estimated_revenue: 0,
        estimated_expenses: 0,
        vat_collected: 0,
        vat_paid: 0,
        vat_due: 0,
        income_tax_base: 0,
        income_tax_due: 0,
        notes: null,
        metadata: null,
      });
      return mapTaxPeriodRow(demoPeriodToRow(record));
    }
    throw error;
  }
}

export async function listTaxPeriodsForSaas(
  ctx: TaxContext,
  params?: { periodType?: SaasTaxPeriodType | null },
): Promise<SaasTaxPeriod[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    let items = listDemoTaxPeriodsForSaas(demoTenantId(ctx), saasId);
    if (params?.periodType) {
      items = items.filter((item) => item.period_type === params.periodType);
    }
    return items.map((row) => mapTaxPeriodRow(demoPeriodToRow(row)));
  }
  try {
    const rows = await queryAll<TaxPeriodRow>(
      `SELECT * FROM saas_tax_periods WHERE tenant_id = ? AND saas_id = ?${params?.periodType ? " AND period_type = ?" : ""}
       ORDER BY period_key DESC`,
      ctx.tenantId,
      saasId,
      ...(params?.periodType ? [params.periodType] : []),
    );
    return rows.map(mapTaxPeriodRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      let items = listDemoTaxPeriodsForSaas(demoTenantId(ctx), saasId);
      if (params?.periodType) {
        items = items.filter((item) => item.period_type === params.periodType);
      }
      return items.map((row) => mapTaxPeriodRow(demoPeriodToRow(row)));
    }
    throw error;
  }
}

export async function updateTaxPeriodStatus(ctx: TaxContext, id: string, status: SaasTaxPeriodStatus): Promise<void> {
  if (ctx.mode === "demo") {
    upsertDemoTaxPeriod(demoTenantId(ctx), { id, saas_id: requireSaasId(ctx), period_type: "QUARTERLY", period_key: id, status } as DemoSaasTaxPeriod);
    return;
  }
  await run(
    `UPDATE saas_tax_periods SET status = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?`,
    status,
    ctx.tenantId,
    id,
  );
}

export async function updateTaxPeriod(
  ctx: TaxContext,
  period: Pick<SaasTaxPeriod, "id" | "periodType" | "periodKey" | "startDate" | "endDate">,
  updates: Pick<
    SaasTaxPeriod,
    "estimatedRevenue" | "estimatedExpenses" | "vatCollected" | "vatPaid" | "vatDue" | "incomeTaxBase" | "incomeTaxDue" | "status" | "notes" | "metadata"
  >,
): Promise<SaasTaxPeriod> {
  if (ctx.mode === "demo") {
    const record = upsertDemoTaxPeriod(demoTenantId(ctx), {
      id: period.id,
      saas_id: requireSaasId(ctx),
      period_type: period.periodType,
      period_key: period.periodKey,
      start_date: period.startDate,
      end_date: period.endDate,
      status: updates.status,
      estimated_revenue: updates.estimatedRevenue,
      estimated_expenses: updates.estimatedExpenses,
      vat_collected: updates.vatCollected,
      vat_paid: updates.vatPaid,
      vat_due: updates.vatDue,
      income_tax_base: updates.incomeTaxBase,
      income_tax_due: updates.incomeTaxDue,
      notes: updates.notes ?? null,
      metadata: updates.metadata ? JSON.stringify(updates.metadata) : null,
    });
    return mapTaxPeriodRow(demoPeriodToRow(record));
  }
  await run(
    `UPDATE saas_tax_periods
     SET estimated_revenue = ?, estimated_expenses = ?, vat_collected = ?, vat_paid = ?, vat_due = ?, income_tax_base = ?, income_tax_due = ?, status = ?, notes = ?, metadata = ?, updated_at = datetime('now')
     WHERE tenant_id = ? AND id = ?`,
    updates.estimatedRevenue,
    updates.estimatedExpenses,
    updates.vatCollected,
    updates.vatPaid,
    updates.vatDue,
    updates.incomeTaxBase,
    updates.incomeTaxDue,
    updates.status,
    updates.notes ?? null,
    updates.metadata ? JSON.stringify(updates.metadata) : null,
    ctx.tenantId,
    period.id,
  );
  const rows = await queryAll<TaxPeriodRow>(
    `SELECT * FROM saas_tax_periods WHERE tenant_id = ? AND id = ? LIMIT 1`,
    ctx.tenantId,
    period.id,
  );
  return mapTaxPeriodRow(rows[0]);
}
