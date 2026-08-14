import { env } from "@/lib/cf";
import type { CanonicalSubscriptionState } from "@/lib/billing/subscriptions";
import type { MentoriaBillingSummary, MentoriaBillingUsage, MentoriaGrowthEntitlements, MentoriaPlanCode } from "@/lib/mentoria/types";

type MentoriaPlanDefinition = {
  code: MentoriaPlanCode;
  label: string;
  limits: MentoriaBillingSummary["limits"];
  features: MentoriaBillingSummary["features"];
  stripePriceEnv?: string;
};

type LimitKey = keyof MentoriaBillingSummary["limits"];

const ENTITLED_STATUSES = new Set(["active", "trialing", "trial"]);

const MENTORIA_PLANS: Record<MentoriaPlanCode, MentoriaPlanDefinition> = {
  free: {
    code: "free",
    label: "Free",
    limits: {
      guidedSessionsPerDay: 3,
      exercisesPerDay: 5,
      plannerRegenerationsPerDay: 1,
    },
    features: {
      fullParentHub: false,
      advancedParentInsights: false,
      adaptiveInterventions: false,
      adaptiveMotivation: false,
      multiStudentSeats: 1,
    },
  },
  pro: {
    code: "pro",
    label: "Pro",
    limits: {
      guidedSessionsPerDay: 20,
      exercisesPerDay: 40,
      plannerRegenerationsPerDay: 8,
    },
    features: {
      fullParentHub: true,
      advancedParentInsights: true,
      adaptiveInterventions: true,
      adaptiveMotivation: true,
      multiStudentSeats: 1,
    },
    stripePriceEnv: "MENTORIA_STRIPE_PRICE_PRO",
  },
  family: {
    code: "family",
    label: "Family",
    limits: {
      guidedSessionsPerDay: 60,
      exercisesPerDay: 120,
      plannerRegenerationsPerDay: 20,
    },
    features: {
      fullParentHub: true,
      advancedParentInsights: true,
      adaptiveInterventions: true,
      adaptiveMotivation: true,
      multiStudentSeats: 4,
    },
    stripePriceEnv: "MENTORIA_STRIPE_PRICE_FAMILY",
  },
};

function normalizePlanCode(value: string | null | undefined): MentoriaPlanCode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "pro" || normalized === "family") {
    return normalized;
  }
  return "free";
}

function resolveRecommendedPlan(input: { planCode: MentoriaPlanCode; limitKey?: LimitKey; feature?: keyof MentoriaBillingSummary["features"] }): Exclude<MentoriaPlanCode, "free"> {
  const familyPriceConfigured = Boolean(getMentoriaStripePriceId("family"));
  if (input.planCode === "free") {
    return input.feature === "advancedParentInsights" && familyPriceConfigured ? "family" : "pro";
  }
  return familyPriceConfigured ? "family" : "pro";
}

export function getMentoriaPlanDefinition(planCode: MentoriaPlanCode): MentoriaPlanDefinition {
  return MENTORIA_PLANS[planCode];
}

export function getMentoriaStripePriceId(planCode: Exclude<MentoriaPlanCode, "free">): string | null {
  const envKey = MENTORIA_PLANS[planCode].stripePriceEnv;
  if (!envKey) return null;
  const direct = typeof process !== "undefined" ? process.env[envKey] : null;
  if (direct?.trim()) return direct.trim();
  const cfEnv = env();
  const bound = cfEnv && envKey in cfEnv ? cfEnv[envKey as keyof typeof cfEnv] : null;
  return typeof bound === "string" && bound.trim().length > 0 ? bound.trim() : null;
}

export function resolveMentoriaPlanCode(
  subscription: CanonicalSubscriptionState | null,
  options?: { isInternalAccount?: boolean },
): MentoriaPlanCode {
  // Cuenta interna (internal_accounts, DRACO_DB) — ignora saas_subscriptions y
  // devuelve el plan más alto del catálogo, "family" (60 sesiones guiadas/día, 4
  // seats). Mentoria no tiene split por accountType como Socialcors, así que aquí
  // no hace falta ningún parámetro adicional más allá del flag.
  if (options?.isInternalAccount) {
    return "family";
  }
  if (!subscription || !ENTITLED_STATUSES.has(subscription.status)) {
    return "free";
  }
  return normalizePlanCode(subscription.planCode);
}

export function buildMentoriaBillingSummary(input: {
  subscription: CanonicalSubscriptionState | null;
  usage: MentoriaBillingUsage;
  canManageBilling: boolean;
  isInternalAccount?: boolean;
}): MentoriaBillingSummary {
  const planCode = resolveMentoriaPlanCode(input.subscription, { isInternalAccount: input.isInternalAccount });
  const plan = getMentoriaPlanDefinition(planCode);
  const limitReached =
    input.usage.guidedSessionsToday >= plan.limits.guidedSessionsPerDay
      ? "guidedSessionsPerDay"
      : input.usage.exercisesToday >= plan.limits.exercisesPerDay
        ? "exercisesPerDay"
        : input.usage.plannerRegenerationsToday >= plan.limits.plannerRegenerationsPerDay
          ? "plannerRegenerationsPerDay"
          : null;

  const paywall =
    limitReached || !plan.features.fullParentHub
      ? {
          title:
            limitReached === "guidedSessionsPerDay"
              ? "Tu ritmo de hoy ya ha llegado al limite del plan actual"
              : limitReached === "exercisesPerDay"
                ? "Hoy ya has usado todas las practicas incluidas en tu plan"
                : limitReached === "plannerRegenerationsPerDay"
                  ? "Has agotado las regeneraciones del planner de hoy"
                  : "El panel familiar avanzado esta reservado para planes premium",
          message:
            limitReached === "guidedSessionsPerDay"
              ? `Has usado ${input.usage.guidedSessionsToday}/${plan.limits.guidedSessionsPerDay} sesiones guiadas. Sube de plan para mantener acompanamiento continuo sin cortar la rutina.`
              : limitReached === "exercisesPerDay"
                ? `Has usado ${input.usage.exercisesToday}/${plan.limits.exercisesPerDay} ejercicios hoy. El upgrade abre mas practica y refuerzo en el mismo dia.`
                : limitReached === "plannerRegenerationsPerDay"
                  ? `Has usado ${input.usage.plannerRegenerationsToday}/${plan.limits.plannerRegenerationsPerDay} ajustes del planner hoy. Un plan superior desbloquea iteracion real del estudio.`
                  : "Ya tienes seguimiento basico. El upgrade desbloquea insights completos, alertas adaptativas y recomendaciones accionables para la familia.",
          ctaLabel: input.canManageBilling ? "Mejorar plan" : "Pedir mejora del plan",
          recommendedPlan: resolveRecommendedPlan({
            planCode,
            limitKey: limitReached ?? undefined,
            feature: !plan.features.fullParentHub ? "fullParentHub" : undefined,
          }),
          canManageBilling: input.canManageBilling,
        }
      : null;

  return {
    planCode,
    planLabel: plan.label,
    subscriptionStatus: input.subscription?.status ?? "free",
    stripeCustomerId: input.subscription?.stripeCustomerId,
    stripeSubscriptionId: input.subscription?.stripeSubscriptionId,
    currentPeriodEnd: input.subscription?.currentPeriodEnd ?? null,
    usage: input.usage,
    limits: plan.limits,
    features: plan.features,
    paywall,
  };
}

export function applyMentoriaGrowthEntitlements(
  billing: MentoriaBillingSummary,
  entitlements: MentoriaGrowthEntitlements,
  now = new Date().toISOString(),
): MentoriaBillingSummary {
  const hasPremiumBoost = Boolean(entitlements.premiumAccessUntil && entitlements.premiumAccessUntil > now);
  const activeFeatureUnlocks = entitlements.featureUnlocks;
  const overlayPlan = hasPremiumBoost && billing.planCode === "free" ? getMentoriaPlanDefinition("pro") : null;
  const features = {
    ...billing.features,
    ...(activeFeatureUnlocks.advanced_parent_insights ? { advancedParentInsights: true, fullParentHub: true } : {}),
    ...(activeFeatureUnlocks.adaptive_motivation_boost ? { adaptiveMotivation: true } : {}),
  };

  return {
    ...billing,
    planCode: overlayPlan ? "pro" : billing.planCode,
    planLabel: overlayPlan ? `${overlayPlan.label} Reward` : billing.planLabel,
    limits: overlayPlan ? overlayPlan.limits : billing.limits,
    features: overlayPlan ? { ...overlayPlan.features, ...features } : features,
    paywall: overlayPlan ? null : billing.paywall,
  };
}

export function isMentoriaFeatureEnabled(
  billing: MentoriaBillingSummary,
  feature: keyof MentoriaBillingSummary["features"],
): boolean {
  return Boolean(billing.features[feature]);
}

export function isMentoriaLimitExceeded(billing: MentoriaBillingSummary, limitKey: LimitKey): boolean {
  const usageMap: Record<LimitKey, number> = {
    guidedSessionsPerDay: billing.usage.guidedSessionsToday,
    exercisesPerDay: billing.usage.exercisesToday,
    plannerRegenerationsPerDay: billing.usage.plannerRegenerationsToday,
  };
  return usageMap[limitKey] >= billing.limits[limitKey];
}

export class MentoriaBillingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly billing: MentoriaBillingSummary,
  ) {
    super(message);
  }
}

export function assertMentoriaLimit(
  billing: MentoriaBillingSummary,
  limitKey: LimitKey,
  message: string,
  code: string,
): void {
  if (isMentoriaLimitExceeded(billing, limitKey)) {
    throw new MentoriaBillingError(message, code, 429, billing);
  }
}

export function assertMentoriaFeature(
  billing: MentoriaBillingSummary,
  feature: keyof MentoriaBillingSummary["features"],
  message: string,
  code: string,
): void {
  if (!isMentoriaFeatureEnabled(billing, feature)) {
    throw new MentoriaBillingError(message, code, 402, billing);
  }
}
