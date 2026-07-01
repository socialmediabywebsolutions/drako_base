import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import { listSaasSocialAccounts, resolveSocialContext } from "@/lib/socialflow/repository";
import { resolveSocialFlowPlanCode, type SocialFlowPlanCode } from "./plans";

const PLAN_MAX_CHANNELS: Record<SocialFlowPlanCode, number> = {
  free: 1,
  influencer_basico: 3,
  influencer_pro: Infinity,
  empresa_basica: 5,
  empresa_pro: Infinity,
};

const PLAN_MAX_UPLOADS_PER_BATCH: Record<SocialFlowPlanCode, number> = {
  free: 30,               // sin plan — no se limita para no bloquear onboarding
  influencer_basico: 30,  // Influencer Básico (49€)
  influencer_pro: 60,     // Influencer Pro (99€)
  empresa_basica: 30,     // Empresa Básica (79€)
  empresa_pro: 60,        // Empresa Pro (149€)
};

const PLAN_AI_ALLOWED: Record<SocialFlowPlanCode, boolean> = {
  free: false,
  influencer_basico: true,
  influencer_pro: true,
  empresa_basica: true,
  empresa_pro: true,
};

export type PlanGuardResult =
  | { ok: true; planCode: SocialFlowPlanCode }
  | { ok: false; code: string; message: string; planCode: SocialFlowPlanCode };

export async function guardChannelLimit(
  tenantId: string,
  saasId: string,
): Promise<PlanGuardResult> {
  const [snapshot, ctx] = await Promise.all([
    getCanonicalBillingSnapshot({ tenantId, saasSlug: "socialflow" }),
    resolveSocialContext({ tenantId, saasId }),
  ]);

  const planCode = resolveSocialFlowPlanCode(snapshot.subscription);
  const maxChannels = PLAN_MAX_CHANNELS[planCode];
  const accounts = await listSaasSocialAccounts(ctx);
  const activeCount = accounts.filter((a) => a.status !== "DISCONNECTED").length;

  if (activeCount >= maxChannels) {
    const limitLabel = maxChannels === Infinity ? "ilimitados" : String(maxChannels);
    return {
      ok: false,
      code: "PLAN_CHANNEL_LIMIT_REACHED",
      message: `Tu plan ${planCode} permite hasta ${limitLabel} canal${maxChannels === 1 ? "" : "es"} conectado${maxChannels === 1 ? "" : "s"}. Actualiza tu plan para conectar más.`,
      planCode,
    };
  }

  return { ok: true, planCode };
}

// Tenants and roles that always get AI access regardless of Stripe plan.
// Remove once live-mode billing is active for all customers.
const AI_BYPASS_TENANT_IDS = new Set(["socialflow-core"]);
const AI_BYPASS_ROLES = new Set(["owner", "admin"]);

export async function guardAiAccess(
  tenantId: string,
  role?: string,
): Promise<PlanGuardResult> {
  if (AI_BYPASS_TENANT_IDS.has(tenantId) || (role && AI_BYPASS_ROLES.has(role))) {
    return { ok: true, planCode: "influencer_pro" };
  }

  const snapshot = await getCanonicalBillingSnapshot({ tenantId, saasSlug: "socialflow" });
  const planCode = resolveSocialFlowPlanCode(snapshot.subscription);

  if (!PLAN_AI_ALLOWED[planCode]) {
    return {
      ok: false,
      code: "PLAN_AI_ACCESS_DENIED",
      message: "La generación de campañas con IA requiere un plan de pago. Actualiza a Creator o Pro para desbloquearla.",
      planCode,
    };
  }

  return { ok: true, planCode };
}

export async function isActiveSocialFlowTrial(tenantId: string, role?: string): Promise<boolean> {
  if (AI_BYPASS_TENANT_IDS.has(tenantId) || (role && AI_BYPASS_ROLES.has(role))) return false;
  const snapshot = await getCanonicalBillingSnapshot({ tenantId, saasSlug: "socialflow" });
  const sub = snapshot.subscription;
  const trialEndsAt = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  return sub.status === "trial" && trialEndsAt !== null && trialEndsAt > new Date();
}

export async function getUploadBatchLimit(tenantId: string, role?: string): Promise<number> {
  if (AI_BYPASS_TENANT_IDS.has(tenantId) || (role && AI_BYPASS_ROLES.has(role))) {
    return PLAN_MAX_UPLOADS_PER_BATCH.influencer_pro;
  }
  const snapshot = await getCanonicalBillingSnapshot({ tenantId, saasSlug: "socialflow" });
  const sub = snapshot.subscription;

  // Cap at 1 per batch during active trial (lets users taste the product without abusing it)
  const trialEndsAt = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const isActiveTrial = sub.status === "trial" && trialEndsAt !== null && trialEndsAt > new Date();
  if (isActiveTrial) return 1;

  const planCode = resolveSocialFlowPlanCode(sub);
  return PLAN_MAX_UPLOADS_PER_BATCH[planCode];
}
