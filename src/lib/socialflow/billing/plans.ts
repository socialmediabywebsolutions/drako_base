export type SocialFlowPlanCode = "free" | "influencer_basico" | "influencer_pro" | "empresa_basica" | "empresa_pro";

export type SocialFlowAccountType = "influencer" | "empresa";

export type SocialFlowPlanDefinition = {
  code: SocialFlowPlanCode;
  label: string;
  priceEur: number | null;
  description: string;
  features: string[];
  accountType: SocialFlowAccountType | null;
  stripePriceId: string | null;
};

const ENTITLED_STATUSES = new Set(["active", "trialing", "trial"]);

const SOCIALFLOW_PLANS: Record<SocialFlowPlanCode, SocialFlowPlanDefinition> = {
  free: {
    code: "free",
    label: "Free",
    priceEur: null,
    description: "Get started with SocialFlow at no cost.",
    features: ["1 connected channel", "Manual post scheduling", "Basic analytics"],
    accountType: null,
    stripePriceId: null,
  },
  influencer_basico: {
    code: "influencer_basico",
    label: "Influencer Básico",
    priceEur: 49,
    description: "Para creadores independientes que hacen crecer su presencia social.",
    features: [
      "Instagram + TikTok",
      "30 posts/mes por red",
      "IA para captions y hashtags",
      "Calendario de contenido",
      "Publicación automática",
    ],
    accountType: "influencer",
    stripePriceId: "price_1ToSwfGW3NNEeb7o77tsfe67",
  },
  influencer_pro: {
    code: "influencer_pro",
    label: "Influencer Pro",
    priceEur: 99,
    description: "Para creadores y equipos que operan a mayor escala.",
    features: [
      "Instagram + TikTok + Facebook + YouTube",
      "60 posts/mes por red",
      "IA avanzada + análisis de imagen",
      "Detección de leads y comunidad",
      "Analytics avanzados",
    ],
    accountType: "influencer",
    stripePriceId: "price_1ToTA3GW3NNEeb7oqsZHPS5P",
  },
  empresa_basica: {
    code: "empresa_basica",
    label: "Empresa Básica",
    priceEur: 79,
    description: "Para negocios que gestionan su presencia social con un equipo pequeño.",
    features: [
      "Instagram + Facebook + LinkedIn",
      "30 posts/mes por red",
      "Base de Conocimiento (web + PDFs + catálogos)",
      "CRM Social básico",
      "Respuesta automática comentarios y DMs",
      "2 usuarios (dueño + community manager)",
    ],
    accountType: "empresa",
    stripePriceId: "price_1ToTHVGW3NNEeb7o6OvHjAcZ",
  },
  empresa_pro: {
    code: "empresa_pro",
    label: "Empresa Pro",
    priceEur: 149,
    description: "Para empresas que necesitan reputación, leads y usuarios ilimitados.",
    features: [
      "Instagram + TikTok + Facebook + LinkedIn + Pinterest",
      "60 posts/mes por red",
      "Todo lo de Empresa Básica",
      "Gestión de reputación y alertas",
      "Generación de leads desde DMs",
      "Usuarios ilimitados con roles y permisos",
    ],
    accountType: "empresa",
    stripePriceId: "price_1ToTMGGW3NNEeb7o2wBLc254",
  },
};

export function getSocialFlowPlanDefinition(planCode: SocialFlowPlanCode): SocialFlowPlanDefinition {
  return SOCIALFLOW_PLANS[planCode];
}

export function listSocialFlowPaidPlans(accountType?: SocialFlowAccountType): SocialFlowPlanDefinition[] {
  const paidPlans = [
    SOCIALFLOW_PLANS.influencer_basico,
    SOCIALFLOW_PLANS.influencer_pro,
    SOCIALFLOW_PLANS.empresa_basica,
    SOCIALFLOW_PLANS.empresa_pro,
  ];
  if (!accountType) return paidPlans;
  return paidPlans.filter((plan) => plan.accountType === accountType);
}

export function normalizeSocialFlowPlanCode(value: string | null | undefined): SocialFlowPlanCode {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    // Legacy plan codes kept for subscriptions created before the influencer/empresa split.
    case "creator":
    case "influencer_basico":
      return "influencer_basico";
    case "pro":
    case "influencer_pro":
      return "influencer_pro";
    case "empresa_basica":
      return "empresa_basica";
    case "empresa_pro":
      return "empresa_pro";
    default:
      return "free";
  }
}

export function resolveSocialFlowPlanCode(subscription: { status: string | null; planCode: string | null } | null): SocialFlowPlanCode {
  if (!subscription || !subscription.status || !ENTITLED_STATUSES.has(subscription.status)) {
    return "free";
  }
  return normalizeSocialFlowPlanCode(subscription.planCode);
}

export function getSocialFlowStripePriceId(planCode: Exclude<SocialFlowPlanCode, "free">): string | null {
  return SOCIALFLOW_PLANS[planCode].stripePriceId;
}
