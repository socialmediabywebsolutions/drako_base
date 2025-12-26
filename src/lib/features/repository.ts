import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { queryAll, run } from "@/lib/db";
import { listDemoSaasFeatures, upsertDemoSaasFeature } from "@/lib/admin/demo-data";
import type { DemoSaasFeature } from "@/lib/admin/demo-data";
import type { SaasModule, SaasModuleCode } from "@/lib/blueprints/types";
import type { SaasFeature, SaasFeatureCategory, SaasFeatureKey, SaasFeatureSource, SaasFeatureStatus, UpsertSaasFeatureInput } from "@/lib/features/types";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";

export type FeaturesContextMode = "d1" | "demo";

export type FeaturesContext = {
  tenantId: string;
  saasId: string | null;
  mode: FeaturesContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

export class FeaturesContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeaturesContextError";
  }
}

type FeatureRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  feature_key: string;
  label: string;
  category: string;
  status: string;
  source: string;
  phase_order: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

const FEATURE_DEFAULTS: Record<
  SaasFeatureKey,
  { label: string; category: SaasFeatureCategory; phaseOrder: number }
> = {
  ECONOMY: { label: "Economy Engine", category: "CORE", phaseOrder: 1 },
  HR: { label: "HR & Compliance", category: "OPERATIONS", phaseOrder: 1 },
  EMPLOYEES: { label: "Equipo & Roles", category: "OPERATIONS", phaseOrder: 1 },
  STAFF_PORTAL: { label: "Staff Portal", category: "OPERATIONS", phaseOrder: 1 },
  CLIENT_PORTAL: { label: "Client Portal", category: "MARKETING", phaseOrder: 1 },
  EMAIL_INTAKE: { label: "Email Intake", category: "MARKETING", phaseOrder: 2 },
  SOCIAL: { label: "Social Engine", category: "MARKETING", phaseOrder: 2 },
  OWNER_CONTROL: { label: "Owner Control", category: "ANALYTICS", phaseOrder: 2 },
  TASKS: { label: "Tasks & Execution", category: "OPERATIONS", phaseOrder: 3 },
  KNOWLEDGE: { label: "Knowledge Base", category: "OPERATIONS", phaseOrder: 3 },
  BLUEPRINT: { label: "Blueprint & Factory", category: "CORE", phaseOrder: 0 },
  APPEARANCE_BRANDING: { label: "Branding & Themes", category: "CORE", phaseOrder: 0 },
  TAX_ENGINE: { label: "Tax & Accounting", category: "ANALYTICS", phaseOrder: 2 },
};

const MODULE_TO_FEATURE: Partial<Record<SaasModuleCode, SaasFeatureKey>> = {
  ECONOMY: "ECONOMY",
  HR: "HR",
  EMAIL_INTAKE: "EMAIL_INTAKE",
  SOCIAL: "SOCIAL",
  CLIENT_PORTAL: "CLIENT_PORTAL",
  STAFF_PORTAL: "STAFF_PORTAL",
  OWNER_CONTROL: "OWNER_CONTROL",
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

function shouldFallbackToDemo(error: unknown, ctx: FeaturesContext): boolean {
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

function demoTenantId(ctx: FeaturesContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

function requireSaasId(ctx: FeaturesContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) {
    throw new FeaturesContextError("saasId is required for features.");
  }
  return saasId;
}

function mapFeatureRow(row: FeatureRow): SaasFeature {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    featureKey: row.feature_key as SaasFeatureKey,
    label: row.label,
    category: row.category as SaasFeatureCategory,
    status: row.status as SaasFeatureStatus,
    source: row.source as SaasFeatureSource,
    phaseOrder: row.phase_order ?? 0,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function demoFeatureToRow(record: DemoSaasFeature): FeatureRow {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    saas_id: record.saas_id,
    feature_key: record.feature_key,
    label: record.label,
    category: record.category,
    status: record.status,
    source: record.source,
    phase_order: record.phase_order,
    metadata: record.metadata,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export async function resolveFeaturesContext({
  tenantId,
  saasId,
  env,
}: {
  tenantId: string;
  saasId?: string | null;
  env?: DracoEnv | null;
}): Promise<FeaturesContext> {
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
      env: runtimeEnv,
    };
  }

  if (!demoEnabled) {
    throw new FeaturesContextError("Features module is not enabled for this tenant.");
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

export async function listSaasFeatures(ctx: FeaturesContext): Promise<SaasFeature[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoSaasFeatures(demoTenantId(ctx), saasId).map((row) => mapFeatureRow(demoFeatureToRow(row)));
  }
  try {
    const rows = await queryAll<FeatureRow>(
      `SELECT id, tenant_id, saas_id, feature_key, label, category, status, source, phase_order, metadata, created_at, updated_at
       FROM saas_features
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY phase_order ASC, label ASC`,
      ctx.tenantId,
      saasId,
    );
    return rows.map(mapFeatureRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasFeatures(demoTenantId(ctx), saasId).map((row) => mapFeatureRow(demoFeatureToRow(row)));
    }
    throw error;
  }
}

export async function listEnabledSaasFeatures(ctx: FeaturesContext): Promise<SaasFeature[]> {
  const features = await listSaasFeatures(ctx);
  return features.filter((feature) => feature.status === "ENABLED");
}

export async function getSaasFeatureByKey(ctx: FeaturesContext, featureKey: SaasFeatureKey): Promise<SaasFeature | null> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const record = listDemoSaasFeatures(demoTenantId(ctx), saasId).find((item) => item.feature_key === featureKey);
    return record ? mapFeatureRow(demoFeatureToRow(record)) : null;
  }
  try {
    const rows = await queryAll<FeatureRow>(
      `SELECT id, tenant_id, saas_id, feature_key, label, category, status, source, phase_order, metadata, created_at, updated_at
       FROM saas_features
       WHERE tenant_id = ? AND saas_id = ? AND feature_key = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
      featureKey,
    );
    return rows[0] ? mapFeatureRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = listDemoSaasFeatures(demoTenantId(ctx), saasId).find((item) => item.feature_key === featureKey);
      return record ? mapFeatureRow(demoFeatureToRow(record)) : null;
    }
    throw error;
  }
}

export async function upsertSaasFeature(ctx: FeaturesContext, input: UpsertSaasFeatureInput): Promise<SaasFeature> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const defaults = FEATURE_DEFAULTS[input.featureKey];
  const current = await getSaasFeatureByKey(ctx, input.featureKey);
  const id = current?.id ?? generateUuid();
  const label = input.label ?? current?.label ?? defaults.label;
  const category = input.category ?? current?.category ?? defaults.category;
  const status = input.status ?? current?.status ?? "PLANNED";
  const source = input.source ?? current?.source ?? "MANUAL";
  const phaseOrder = typeof input.phaseOrder === "number" ? input.phaseOrder : current?.phaseOrder ?? defaults.phaseOrder;
  const metadata = typeof input.metadata === "undefined" ? current?.metadata ?? null : input.metadata;

  if (ctx.mode === "demo") {
    const record = upsertDemoSaasFeature(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      feature_key: input.featureKey,
      label,
      category,
      status,
      source,
      phase_order: phaseOrder,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
    return mapFeatureRow(demoFeatureToRow(record));
  }

  await run(
    `INSERT INTO saas_features (id, tenant_id, saas_id, feature_key, label, category, status, source, phase_order, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, saas_id, feature_key)
     DO UPDATE SET label = excluded.label,
                   category = excluded.category,
                   status = excluded.status,
                   source = excluded.source,
                   phase_order = excluded.phase_order,
                   metadata = excluded.metadata,
                   updated_at = excluded.updated_at`,
    id,
    ctx.tenantId,
    saasId,
    input.featureKey,
    label,
    category,
    status,
    source,
    phaseOrder,
    metadata ? JSON.stringify(metadata) : null,
    current?.createdAt ?? now,
    now,
  );

  return {
    id,
    tenantId: ctx.tenantId,
    saasId,
    featureKey: input.featureKey,
    label,
    category,
    status,
    source,
    phaseOrder,
    metadata,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
}

export async function syncFeaturesFromBlueprint(ctx: FeaturesContext, modules: SaasModule[] | null): Promise<SaasFeature[]> {
  if (!modules || modules.length === 0) {
    return listSaasFeatures(ctx);
  }

  const updates: SaasFeature[] = [];
  for (const moduleItem of modules) {
    const featureKey = MODULE_TO_FEATURE[moduleItem.code];
    if (!featureKey) continue;
    const shouldEnable = moduleItem.status === "ACTIVE";
    const status: SaasFeatureStatus | undefined = shouldEnable ? "ENABLED" : "PLANNED";
    const next = await upsertSaasFeature(ctx, {
      tenantId: ctx.tenantId,
      saasId: requireSaasId(ctx),
      featureKey,
      status,
      source: "BLUEPRINT",
      phaseOrder: moduleItem.phase,
    });
    updates.push(next);
  }

  const existing = await listSaasFeatures(ctx);
  const merged = new Map(existing.map((item) => [item.featureKey, item]));
  updates.forEach((item) => merged.set(item.featureKey, item));
  return Array.from(merged.values());
}
