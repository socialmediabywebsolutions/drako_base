import { env } from "@/lib/cf";

export type SocialFlowPlanCode = "free" | "creator" | "pro";

export type SocialFlowPlanDefinition = {
  code: SocialFlowPlanCode;
  label: string;
  priceEur: number | null;
  description: string;
  features: string[];
  stripePriceEnv?: string;
};

const ENTITLED_STATUSES = new Set(["active", "trialing", "trial"]);

const SOCIALFLOW_PLANS: Record<SocialFlowPlanCode, SocialFlowPlanDefinition> = {
  free: {
    code: "free",
    label: "Free",
    priceEur: null,
    description: "Get started with SocialFlow at no cost.",
    features: ["1 connected channel", "Manual post scheduling", "Basic analytics"],
  },
  creator: {
    code: "creator",
    label: "Creator",
    priceEur: 49,
    description: "For independent creators growing their social presence.",
    features: ["3 connected channels", "AI campaign generation", "Content calendar", "Email support"],
    stripePriceEnv: "SOCIALFLOW_STRIPE_PRICE_CREATOR",
  },
  pro: {
    code: "pro",
    label: "Pro",
    priceEur: 99,
    description: "For agencies and teams running social at scale.",
    features: ["Unlimited connected channels", "AI campaign generation", "Priority support", "Advanced analytics"],
    stripePriceEnv: "SOCIALFLOW_STRIPE_PRICE_PRO",
  },
};

export function getSocialFlowPlanDefinition(planCode: SocialFlowPlanCode): SocialFlowPlanDefinition {
  return SOCIALFLOW_PLANS[planCode];
}

export function listSocialFlowPaidPlans(): SocialFlowPlanDefinition[] {
  return [SOCIALFLOW_PLANS.creator, SOCIALFLOW_PLANS.pro];
}

export function normalizeSocialFlowPlanCode(value: string | null | undefined): SocialFlowPlanCode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "creator" || normalized === "pro") {
    return normalized;
  }
  return "free";
}

export function resolveSocialFlowPlanCode(subscription: { status: string | null; planCode: string | null } | null): SocialFlowPlanCode {
  if (!subscription || !subscription.status || !ENTITLED_STATUSES.has(subscription.status)) {
    return "free";
  }
  return normalizeSocialFlowPlanCode(subscription.planCode);
}

export function getSocialFlowStripePriceId(planCode: Exclude<SocialFlowPlanCode, "free">): string | null {
  const envKey = SOCIALFLOW_PLANS[planCode].stripePriceEnv;
  if (!envKey) return null;
  const direct = typeof process !== "undefined" ? process.env[envKey] : null;
  if (direct?.trim()) return direct.trim();
  const cfEnv = env();
  const bound = cfEnv && envKey in cfEnv ? cfEnv[envKey as keyof typeof cfEnv] : null;
  return typeof bound === "string" && bound.trim().length > 0 ? bound.trim() : null;
}
