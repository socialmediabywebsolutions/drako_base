import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import { listSaasSocialAccounts, resolveSocialContext } from "@/lib/socialflow/repository";
import { resolveSocialFlowPlanCode, type SocialFlowPlanCode } from "./plans";

const PLAN_MAX_CHANNELS: Record<SocialFlowPlanCode, number> = {
  free: 1,
  creator: 3,
  pro: Infinity,
};

const PLAN_AI_ALLOWED: Record<SocialFlowPlanCode, boolean> = {
  free: false,
  creator: true,
  pro: true,
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

export async function guardAiAccess(tenantId: string): Promise<PlanGuardResult> {
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
