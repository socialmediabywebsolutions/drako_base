export type SocialFlowPlanCode =
  | "free"
  | "influencer_starter"
  | "influencer_basico"
  | "influencer_pro"
  | "empresa_starter"
  | "empresa_basico"
  | "empresa_pro";

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
    description: "Get started with Socialcors at no cost.",
    features: ["1 connected channel", "Manual post scheduling", "Basic analytics"],
    accountType: null,
    stripePriceId: null,
  },
  influencer_starter: {
    code: "influencer_starter",
    label: "Influencer Starter",
    priceEur: 99,
    description: "Para creadores que empiezan a organizar su presencia social.",
    features: [
      "Instagram",
      "1 pieza/día por formato (post, reel, historia, carrusel) — ~30/mes",
      "IA para captions y hashtags",
      "Calendario de contenido",
      "Publicación automática",
    ],
    accountType: "influencer",
    stripePriceId: null,
  },
  influencer_basico: {
    code: "influencer_basico",
    label: "Influencer Básico",
    priceEur: 179,
    description: "Para creadores independientes que hacen crecer su presencia social.",
    features: [
      "Instagram",
      "2 piezas/día por formato (post, reel, historia, carrusel) — ~60/mes",
      "IA para captions y hashtags",
      "Análisis de imagen con LLaVA",
      "Calendario de contenido",
      "Publicación automática",
    ],
    accountType: "influencer",
    stripePriceId: null,
  },
  influencer_pro: {
    code: "influencer_pro",
    label: "Influencer Pro",
    priceEur: 299,
    description: "Para creadores que ya publican en varias redes y quieren automatizar más.",
    features: [
      "Instagram",
      "3 piezas/día por formato (post, reel, historia, carrusel) — ~90/mes",
      "IA avanzada + análisis de imagen",
      "Calendario de contenido",
      "Publicación automática",
      "Analytics avanzados",
    ],
    accountType: "influencer",
    stripePriceId: null,
  },
  empresa_starter: {
    code: "empresa_starter",
    label: "Empresa Starter",
    priceEur: 169,
    description: "Para negocios que empiezan a organizar su presencia social.",
    features: [
      "Instagram",
      "1 pieza/día por formato (post, reel, historia, carrusel) — ~30/mes",
      "Base de Conocimiento (web + PDFs + catálogos)",
      "Respuesta automática comentarios y DMs",
    ],
    accountType: "empresa",
    stripePriceId: null,
  },
  empresa_basico: {
    code: "empresa_basico",
    label: "Empresa Básico",
    priceEur: 299,
    description: "Para negocios que gestionan su presencia social con un equipo pequeño.",
    features: [
      "Instagram",
      "2 piezas/día por formato (post, reel, historia, carrusel) — ~60/mes",
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
    priceEur: 449,
    description: "Para empresas que necesitan gestionar su presencia en Instagram a mayor escala.",
    features: [
      "Instagram",
      "3 piezas/día por formato (post, reel, historia, carrusel) — ~90/mes",
      "Todo lo de Empresa Básico",
      "Gestión de reputación y alertas",
      "Generación de leads desde DMs",
      "Usuarios ilimitados con roles y permisos",
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
    SOCIALFLOW_PLANS.influencer_starter,
    SOCIALFLOW_PLANS.influencer_basico,
    SOCIALFLOW_PLANS.influencer_pro,
    SOCIALFLOW_PLANS.empresa_starter,
    SOCIALFLOW_PLANS.empresa_basico,
    SOCIALFLOW_PLANS.empresa_pro,
  ];
  if (!accountType) return paidPlans;
  return paidPlans.filter((plan) => plan.accountType === accountType);
}

export function normalizeSocialFlowPlanCode(value: string | null | undefined): SocialFlowPlanCode {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    // Legacy plan codes kept for subscriptions created before the influencer/empresa split,
    // before the empresa_basica → empresa_basico rename, and before the 2026-07 Starter/Elite
    // catalog cleanup. "influencer_elite"/"empresa_elite" are intentionally NOT mapped here —
    // any row still carrying one of those falls through to the "free" default below rather
    // than being silently upgraded to a plan nobody signed up for.
    case "creator":
    case "influencer_basico":
      return "influencer_basico";
    case "influencer_starter":
      return "influencer_starter";
    case "pro":
    case "influencer_pro":
      return "influencer_pro";
    case "empresa_basica":
    case "empresa_basico":
      return "empresa_basico";
    case "empresa_starter":
      return "empresa_starter";
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
