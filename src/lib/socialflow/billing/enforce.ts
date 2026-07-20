import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import { listSaasSocialAccounts, resolveSocialContext } from "@/lib/socialflow/repository";
import { resolveSocialFlowPlanCode, type SocialFlowPlanCode } from "./plans";

// Sin extras ni add-ons: el límite de canales coincide exactamente con el número
// de redes incluidas en cada plan (ver network-entitlements.ts).
const PLAN_MAX_CHANNELS: Record<SocialFlowPlanCode, number> = {
  free: 1,
  influencer_starter: 1,  // Instagram
  influencer_basico: 1,   // Instagram
  influencer_pro: 2,      // Instagram + Facebook
  empresa_starter: 1,     // Instagram o LinkedIn (a elegir)
  empresa_basico: 1,      // Instagram o LinkedIn (a elegir)
  empresa_pro: 2,         // Instagram + LinkedIn
};

// Multiplicador de piezas/día por formato (post, reel, historia, carrusel) — igual
// para los 4 formatos. El límite de lote real es días_del_mes_actual × multiplicador
// (ver getUploadBatchLimit), así julio (31 días) permite más de golpe que febrero.
const PLAN_DAILY_MULTIPLIER: Record<Exclude<SocialFlowPlanCode, "free">, number> = {
  influencer_starter: 1,
  influencer_basico: 2,
  influencer_pro: 3,
  empresa_starter: 1,
  empresa_basico: 2,
  empresa_pro: 3,
};

// Tenants sin plan activo (free): límite fijo, no se multiplica por días del mes.
const FREE_TIER_UPLOAD_BATCH_LIMIT = 30;

function daysInCurrentMonth(reference: Date = new Date()): number {
  return new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();
}

const PLAN_AI_ALLOWED: Record<SocialFlowPlanCode, boolean> = {
  free: false,
  influencer_starter: true,
  influencer_basico: true,
  influencer_pro: true,
  empresa_starter: true,
  empresa_basico: true,
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
    return PLAN_DAILY_MULTIPLIER.influencer_pro * daysInCurrentMonth();
  }
  const snapshot = await getCanonicalBillingSnapshot({ tenantId, saasSlug: "socialflow" });
  const sub = snapshot.subscription;

  // Cap at 1 per batch during active trial (lets users taste the product without abusing it)
  const trialEndsAt = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const isActiveTrial = sub.status === "trial" && trialEndsAt !== null && trialEndsAt > new Date();
  if (isActiveTrial) return 1;

  const planCode = resolveSocialFlowPlanCode(sub);
  if (planCode === "free") return FREE_TIER_UPLOAD_BATCH_LIMIT;
  return PLAN_DAILY_MULTIPLIER[planCode] * daysInCurrentMonth();
}
