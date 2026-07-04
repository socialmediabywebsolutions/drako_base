export type SocialFlowPlanCode =
  | "free"
  | "influencer_basico"
  | "influencer_pro"
  | "influencer_elite"
  | "empresa_basico"
  | "empresa_pro"
  | "empresa_elite";

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

// NOTE: every paid plan below changed price and/or network mix vs. the previous
// structure, so the old Stripe Price IDs no longer match these SKUs. All
// stripePriceId fields are null until the corresponding prices are created in
// Stripe (Dashboard → Products) — checkout will return
// SOCIALFLOW_STRIPE_PRICE_NOT_CONFIGURED for a plan until its priceId is set here.
// TODO(stripe): create 6 new Stripe Prices (one per paid plan below) and fill in
// stripePriceId once available.
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
      "Instagram",
      "90 posts/mes por red (3 posts/día)",
      "IA para captions y hashtags",
      "Calendario de contenido",
      "Publicación automática",
    ],
    accountType: "influencer",
    stripePriceId: null,
  },
  influencer_pro: {
    code: "influencer_pro",
    label: "Influencer Pro",
    priceEur: 79,
    description: "Para creadores que ya publican en varias redes y quieren automatizar más.",
    features: [
      "Instagram + Facebook",
      "90 posts/mes por red (3 posts/día)",
      "IA avanzada + análisis de imagen",
      "Calendario de contenido",
      "Publicación automática",
      "Analytics avanzados",
    ],
    accountType: "influencer",
    stripePriceId: null,
  },
  influencer_elite: {
    code: "influencer_elite",
    label: "Influencer Elite",
    priceEur: 99,
    description: "Para creadores y equipos que operan a mayor escala en todas las redes.",
    features: [
      "Instagram + Facebook + LinkedIn",
      "90 posts/mes por red (3 posts/día)",
      "IA avanzada + análisis de imagen",
      "Detección de leads y comunidad",
      "Analytics avanzados",
      "Soporte prioritario",
    ],
    accountType: "influencer",
    stripePriceId: null,
  },
  empresa_basico: {
    code: "empresa_basico",
    label: "Empresa Básico",
    priceEur: 99,
    description: "Para negocios que gestionan su presencia social con un equipo pequeño.",
    features: [
      "Instagram o LinkedIn (eliges una red principal en el onboarding)",
      "90 posts/mes por red (3 posts/día)",
      "Base de Conocimiento (web + PDFs + catálogos)",
      "CRM Social básico",
      "Respuesta automática comentarios y DMs",
      "2 usuarios (dueño + community manager)",
    ],
    accountType: "empresa",
    stripePriceId: null,
  },
  empresa_pro: {
    code: "empresa_pro",
    label: "Empresa Pro",
    priceEur: 149,
    description: "Para empresas que necesitan gestionar Instagram y LinkedIn a la vez.",
    features: [
      "Instagram + LinkedIn",
      "90 posts/mes por red (3 posts/día)",
      "Todo lo de Empresa Básico",
      "Gestión de reputación y alertas",
      "Generación de leads desde DMs",
      "Usuarios ilimitados con roles y permisos",
    ],
    accountType: "empresa",
    stripePriceId: null,
  },
  empresa_elite: {
    code: "empresa_elite",
    label: "Empresa Elite",
    priceEur: 199,
    description: "Para empresas que necesitan reputación, leads y presencia completa en redes.",
    features: [
      "Instagram + LinkedIn + Facebook",
      "90 posts/mes por red (3 posts/día)",
      "Todo lo de Empresa Pro",
      "Reportes avanzados con comparativa de competencia",
      "Soporte prioritario dedicado",
    ],
    accountType: "empresa",
    stripePriceId: null,
  },
};

export function getSocialFlowPlanDefinition(planCode: SocialFlowPlanCode): SocialFlowPlanDefinition {
  return SOCIALFLOW_PLANS[planCode];
}

export function listSocialFlowPaidPlans(accountType?: SocialFlowAccountType): SocialFlowPlanDefinition[] {
  const paidPlans = [
    SOCIALFLOW_PLANS.influencer_basico,
    SOCIALFLOW_PLANS.influencer_pro,
    SOCIALFLOW_PLANS.influencer_elite,
    SOCIALFLOW_PLANS.empresa_basico,
    SOCIALFLOW_PLANS.empresa_pro,
    SOCIALFLOW_PLANS.empresa_elite,
  ];
  if (!accountType) return paidPlans;
  return paidPlans.filter((plan) => plan.accountType === accountType);
}

export function normalizeSocialFlowPlanCode(value: string | null | undefined): SocialFlowPlanCode {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    // Legacy plan codes kept for subscriptions created before the influencer/empresa split
    // and before the empresa_basica → empresa_basico rename.
    case "creator":
    case "influencer_basico":
      return "influencer_basico";
    case "pro":
    case "influencer_pro":
      return "influencer_pro";
    case "influencer_elite":
      return "influencer_elite";
    case "empresa_basica":
    case "empresa_basico":
      return "empresa_basico";
    case "empresa_pro":
      return "empresa_pro";
    case "empresa_elite":
      return "empresa_elite";
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
