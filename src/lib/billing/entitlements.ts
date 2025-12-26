import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { getSaasSubscriptions } from "@/lib/billing/client-saas-subscriptions";
import { listPlanFeatures } from "@/lib/billing/plan-features";
import { listDemoSaasPlanFeatures } from "@/lib/admin/demo-data";
import { listSaasFeatures, getSaasFeatureByKey, resolveFeaturesContext, upsertSaasFeature } from "@/lib/features/repository";
import type { SaasFeatureCategory, SaasFeatureKey } from "@/lib/features/types";

type FeatureMeta = { label: string; category: SaasFeatureCategory; phaseOrder: number };

const FEATURE_METADATA: Record<SaasFeatureKey, FeatureMeta> = {
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

function resolveRuntimeEnv(envOverride?: DracoEnv | null): DracoEnv | null {
  if (envOverride) return envOverride;
  return resolveEnv();
}

function isActiveSubscription(status: string): boolean {
  return status === "active" || status === "trialing";
}

export async function syncSaasFeaturesFromPlan(
  envOverride: DracoEnv | null | undefined,
  tenantId: string,
  saasId: string,
): Promise<{ features: Awaited<ReturnType<typeof listSaasFeatures>>; planId: string | null }> {
  const runtimeEnv = resolveRuntimeEnv(envOverride);
  const subscriptions = await getSaasSubscriptions(tenantId, saasId);
  const sorted = [...subscriptions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const active = sorted.find((sub) => isActiveSubscription(sub.status));
  const current = active ?? sorted[0] ?? null;
  const planId = current?.saasPlanId ?? null;

  const featuresCtx = await resolveFeaturesContext({ tenantId, saasId, env: runtimeEnv });

  if (!planId) {
    return { features: await listSaasFeatures(featuresCtx), planId: null };
  }

  let planFeatures: Array<{ featureKey: SaasFeatureKey }> = [];
  if (runtimeEnv?.DRACO_DB) {
    try {
      const rows = await listPlanFeatures(runtimeEnv.DRACO_DB, planId);
      planFeatures = rows.map((row) => ({ featureKey: row.featureKey }));
    } catch {
      const demoRows = listDemoSaasPlanFeatures(tenantId, planId);
      planFeatures = demoRows.map((row) => ({ featureKey: row.feature_key as SaasFeatureKey }));
    }
  } else {
    const demoRows = listDemoSaasPlanFeatures(tenantId, planId);
    planFeatures = demoRows.map((row) => ({ featureKey: row.feature_key as SaasFeatureKey }));
  }

  for (const planFeature of planFeatures) {
    const currentFeature = await getSaasFeatureByKey(featuresCtx, planFeature.featureKey);
    if (currentFeature) {
      continue;
    }
    const meta = FEATURE_METADATA[planFeature.featureKey];
    await upsertSaasFeature(featuresCtx, {
      tenantId,
      saasId,
      featureKey: planFeature.featureKey,
      label: meta.label,
      category: meta.category,
      status: "ENABLED",
      source: "PLAN",
      phaseOrder: meta.phaseOrder,
    });
  }

  return { features: await listSaasFeatures(featuresCtx), planId };
}
