import type { SaasFeatureKey } from "@/lib/features/types";

export interface SaasPlanFeature {
  id: string;
  planId: string;
  featureKey: SaasFeatureKey;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSaasPlanFeatureInput {
  planId: string;
  featureKey: SaasFeatureKey;
}

type PlanFeatureRow = {
  id: string;
  plan_id: string;
  feature_key: string;
  created_at: string;
  updated_at: string;
};

function mapRow(row: PlanFeatureRow): SaasPlanFeature {
  return {
    id: row.id,
    planId: row.plan_id,
    featureKey: row.feature_key as SaasFeatureKey,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

export async function listPlanFeatures(db: D1Database, planId: string): Promise<SaasPlanFeature[]> {
  const stmt = db.prepare(
    `SELECT id, plan_id, feature_key, created_at, updated_at
     FROM saas_plan_features
     WHERE plan_id = ?
     ORDER BY feature_key ASC`,
  );
  const res = await stmt.bind(planId).all<PlanFeatureRow>();
  return (res.results ?? []).map(mapRow);
}

export async function upsertPlanFeature(db: D1Database, input: UpsertSaasPlanFeatureInput): Promise<SaasPlanFeature> {
  const now = new Date().toISOString();
  const id = generateUuid();
  await db
    .prepare(
      `INSERT INTO saas_plan_features (id, plan_id, feature_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(plan_id, feature_key)
       DO UPDATE SET updated_at = excluded.updated_at`,
    )
    .bind(id, input.planId, input.featureKey, now, now)
    .run();
  const row = await db
    .prepare(
      `SELECT id, plan_id, feature_key, created_at, updated_at
       FROM saas_plan_features
       WHERE plan_id = ? AND feature_key = ?
       LIMIT 1`,
    )
    .bind(input.planId, input.featureKey)
    .first<PlanFeatureRow>();
  if (!row) {
    return {
      id,
      planId: input.planId,
      featureKey: input.featureKey,
      createdAt: now,
      updatedAt: now,
    };
  }
  return mapRow(row);
}
