import type { MentoriaBillingSummary } from "@/lib/mentoria/types";

export type UpgradePrompt = {
  title: string;
  message: string;
  reason: "trial_expired" | "usage_limit_reached";
  daysRemaining?: number;
  currentLimit?: number;
  usedToday?: number;
  upgradeUrl: string;
  ctaText: string;
};

export function buildUpgradePrompt(input: {
  reason: "trial_expired" | "usage_limit_reached";
  daysRemaining?: number;
  currentLimit?: number;
  usedToday?: number;
  upgradeUrl: string;
}): UpgradePrompt {
  if (input.reason === "trial_expired") {
    return {
      title: "Tu prueba gratuita ha expirado",
      message: "Hemos visto que tu hijo está progresando bien. Suscríbete ahora para continuar con acceso ilimitado a sesiones personalizadas.",
      reason: "trial_expired",
      upgradeUrl: input.upgradeUrl,
      ctaText: "Suscribirse ahora",
    };
  }

  return {
    title: "Límite diario alcanzado",
    message: `Has usado ${input.usedToday}/${input.currentLimit} sesiones hoy. Suscríbete para acceso ilimitado y ayuda a tu hijo a aprender más.`,
    reason: "usage_limit_reached",
    usedToday: input.usedToday,
    currentLimit: input.currentLimit,
    upgradeUrl: input.upgradeUrl,
    ctaText: "Desbloquear acceso ilimitado",
  };
}

export function buildTrialExpiringWarning(daysRemaining: number): string {
  if (daysRemaining === 0) {
    return "⚠️ Tu prueba gratuita expira hoy. Suscríbete para continuar.";
  }
  if (daysRemaining === 1) {
    return "⚠️ Tu prueba gratuita expira mañana. Suscríbete para continuar.";
  }
  return `⚠️ Tu prueba gratuita expira en ${daysRemaining} días.`;
}

export class UpgradeFlowError extends Error {
  constructor(
    public code: "trial_expired" | "usage_limit_reached" | "upgrade_required",
    message: string,
    public upgradePrompt?: UpgradePrompt
  ) {
    super(message);
    this.name = "UpgradeFlowError";
  }
}

function allowLocalExpiredTrialBypass() {
  const nodeEnv = typeof process !== "undefined" ? process.env?.NODE_ENV : undefined;
  const flag = typeof process !== "undefined" ? process.env?.MENTORIA_ALLOW_EXPIRED_TRIAL_LOCAL : undefined;
  return nodeEnv !== "production" && flag?.toLowerCase() === "true";
}

export function checkAccessControl(input: {
  isTrialActive: boolean;
  planCode: string;
  limitKey: string;
  currentLimit: number;
  usedToday: number;
  daysRemaining: number;
  upgradeUrl: string;
}): void {
  // If trial is active, allow access
  if (input.isTrialActive) {
    return;
  }

  // If not on trial and on free plan, block access
  if (input.planCode === "free") {
    if (allowLocalExpiredTrialBypass()) {
      return;
    }
    const prompt = buildUpgradePrompt({
      reason: "trial_expired",
      upgradeUrl: input.upgradeUrl,
    });
    throw new UpgradeFlowError("trial_expired", "Trial expired. Please upgrade to continue.", prompt);
  }

  // Check usage limits for paid plans
  if (input.usedToday >= input.currentLimit) {
    const prompt = buildUpgradePrompt({
      reason: "usage_limit_reached",
      currentLimit: input.currentLimit,
      usedToday: input.usedToday,
      upgradeUrl: input.upgradeUrl,
    });
    throw new UpgradeFlowError("usage_limit_reached", "Daily limit reached. Please upgrade.", prompt);
  }
}
