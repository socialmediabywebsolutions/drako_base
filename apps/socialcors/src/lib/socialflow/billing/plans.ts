export type SocialFlowPlanCode =
  | "free"
  | "influencer_starter"
  | "influencer_basico"
  | "influencer_pro"
  | "empresa_starter"
  | "empresa_basico"
  | "empresa_pro";

const STRIPE_PRICES: Record<Exclude<SocialFlowPlanCode, "free">, string> = {
  influencer_starter: "price_1UQ4ehGwtJsJLXCfkYdcr5QL",
  influencer_basico: "price_1UQ4ehGwtJsJLXCfS1GMYFHF",
  influencer_pro: "price_1UQ4eiGwtJsJLXCfr5ecvxda",
  empresa_starter: "price_1UQ4eiGwtJsJLXCfi8PPuqeo",
  empresa_basico: "price_1UQ4ejGwtJsJLXCfDIH1kYYL",
  empresa_pro: "price_1UQ4ekGwtJsJLXCfj1hhcGgH",
};

export function getSocialFlowStripePriceId(plan: Exclude<SocialFlowPlanCode, "free">): string | null {
  return STRIPE_PRICES[plan] || null;
}
