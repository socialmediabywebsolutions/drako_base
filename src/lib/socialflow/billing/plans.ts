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
  // Beneficios que el plan explícitamente NO incluye — usado por las páginas públicas de
  // ventas (landing, /socialflow/planes) para la comparativa ✓/✗. Vacío en los planes Pro
  // (nada que excluir) y en "free" (fuera del alcance de la comparativa de pago).
  notIncluded: string[];
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
    notIncluded: [],
    accountType: null,
    stripePriceId: null,
  },
  influencer_starter: {
    code: "influencer_starter",
    label: "Influencer Starter",
    priceEur: 99,
    description: "Para creadores que empiezan a automatizar",
    features: [
      "8 piezas/semana Instagram",
      "Máx. 2 publicaciones/día",
      "1 historia/día",
      "6 vídeos IA/mes",
      "Caption en tu voz",
      "Hashtags con tracción real",
      "Hora de publicación IA",
      "LinkedIn personal (2/sem)",
    ],
    notIncluded: ["Análisis de competencia", "CRM Social", "Soporte prioritario"],
    accountType: "influencer",
    stripePriceId: "price_1U58y82drYIYdjRXP5JR5Qvt",
  },
  influencer_basico: {
    code: "influencer_basico",
    label: "Influencer Básico",
    priceEur: 179,
    description: "Para creadores que quieren crecer de verdad",
    features: [
      "12 piezas/semana Instagram",
      "Máx. 2 publicaciones/día",
      "2 historias/día",
      "12 vídeos IA/mes",
      "Caption en tu voz",
      "Hashtags con tracción real",
      "Hora de publicación IA",
      "LinkedIn personal (3/sem)",
      "Análisis de imagen con IA",
      "Reels y carruseles automáticos",
    ],
    notIncluded: ["CRM Social", "Soporte prioritario"],
    accountType: "influencer",
    stripePriceId: "price_1U58yE2drYIYdjRXAZhRWgwe",
  },
  influencer_pro: {
    code: "influencer_pro",
    label: "Influencer Pro",
    priceEur: 299,
    description: "Para influencers que quieren el máximo impacto",
    features: [
      "14 piezas/semana Instagram",
      "Máx. 2 publicaciones/día",
      "2 historias/día",
      "20 vídeos IA/mes",
      "Caption en tu voz",
      "Hashtags con tracción real",
      "Hora de publicación IA",
      "LinkedIn personal (5/sem)",
      "Análisis avanzado de imagen",
      "Reels y carruseles automáticos",
      "CRM Social completo",
      "Soporte prioritario",
    ],
    notIncluded: [],
    accountType: "influencer",
    stripePriceId: "price_1U58yL2drYIYdjRXo8UF0HOl",
  },
  empresa_starter: {
    code: "empresa_starter",
    label: "Empresa Starter",
    priceEur: 169,
    description: "Para negocios que quieren empezar a publicar solos",
    features: [
      "6 piezas/semana Instagram",
      "Máx. 2 publicaciones/día",
      "1 historia/día",
      "6 vídeos IA/mes",
      "Reconocimiento de empleados",
      "Caption adaptado a tu marca",
      "Hora de publicación IA",
      "LinkedIn empresa (2/sem)",
      "Página de Facebook",
    ],
    notIncluded: ["CRM Social", "Análisis de competencia", "Soporte prioritario"],
    accountType: "empresa",
    stripePriceId: "price_1U58yR2drYIYdjRXjz92VWoL",
  },
  empresa_basico: {
    code: "empresa_basico",
    label: "Empresa Básico",
    priceEur: 299,
    description: "Para empresas que quieren presencia real en redes",
    features: [
      "10 piezas/semana Instagram",
      "Máx. 2 publicaciones/día",
      "2 historias/día",
      "12 vídeos IA/mes",
      "Reconocimiento de empleados",
      "Caption adaptado a tu marca",
      "Hora de publicación IA",
      "LinkedIn empresa (3/sem)",
      "Página de Facebook",
      "Análisis de imagen con IA",
      "Reels y carruseles automáticos",
    ],
    notIncluded: ["CRM Social", "Soporte prioritario"],
    accountType: "empresa",
    stripePriceId: "price_1U58yX2drYIYdjRXXumbjZSb",
  },
  empresa_pro: {
    code: "empresa_pro",
    label: "Empresa Pro",
    priceEur: 449,
    description: "Para empresas que quieren el máximo rendimiento",
    features: [
      "12 piezas/semana Instagram",
      "Máx. 2 publicaciones/día",
      "2 historias/día",
      "20 vídeos IA/mes",
      "Reconocimiento de empleados",
      "Caption adaptado a tu marca",
      "Hora de publicación IA",
      "LinkedIn empresa (5/sem)",
      "Página de Facebook",
      "Análisis avanzado de imagen",
      "Reels y carruseles automáticos",
      "CRM Social completo",
      "Soporte prioritario",
    ],
    notIncluded: [],
    accountType: "empresa",
    stripePriceId: "price_1U58yd2drYIYdjRXfwSygOoD",
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

export function resolveSocialFlowPlanCode(
  subscription: { status: string | null; planCode: string | null } | null,
  options?: { isInternalAccount?: boolean; accountType?: SocialFlowAccountType | null },
): SocialFlowPlanCode {
  // Cuenta interna (internal_accounts, DRACO_DB) — ignora saas_subscriptions por
  // completo y devuelve el plan más alto disponible según accountType. Ver
  // getCanonicalBillingSnapshot() en @/lib/billing/subscriptions para el flag.
  if (options?.isInternalAccount) {
    return options.accountType === "empresa" ? "empresa_pro" : "influencer_pro";
  }
  if (!subscription || !subscription.status || !ENTITLED_STATUSES.has(subscription.status)) {
    return "free";
  }
  return normalizeSocialFlowPlanCode(subscription.planCode);
}

export function getSocialFlowStripePriceId(planCode: Exclude<SocialFlowPlanCode, "free">): string | null {
  return SOCIALFLOW_PLANS[planCode].stripePriceId;
}
