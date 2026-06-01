import type { SaasBlueprintDraft } from "@/lib/factory/contracts/blueprints";

export const SOCIALFLOW_NAME = "SocialFlow";
export const SOCIALFLOW_SLUG = "socialflows";
export const SOCIALFLOW_DEFAULT_CUSTOM_DOMAIN = "app.socialflow.example.com";

export const SOCIALFLOW_MVP_FEATURES = [
  "SOCIAL",
  "TASKS",
  "OWNER_CONTROL",
  "CLIENT_PORTAL",
] as const satisfies NonNullable<SaasBlueprintDraft["initialFeatures"]>;

export function buildSocialFlowBlueprintDraft(input?: {
  customDomainRequested?: string | null;
}): Partial<SaasBlueprintDraft> {
  return {
    saasName: SOCIALFLOW_NAME,
    proposedSlug: SOCIALFLOW_SLUG,
    proposedSubdomain: SOCIALFLOW_SLUG,
    verticalId: "OTHER",
    summary: "Programa contenidos, conecta cuentas sociales y valida automatizaciones ligeras desde un panel unico.",
    targetAudience: "Equipos pequenos de marketing y operadores de contenido que necesitan una capa SaaS simple sobre multiples canales.",
    mainProblem: "La operacion social vive dispersa entre hojas, calendarios y herramientas sin trazabilidad compartida.",
    mainGoal: "Centralizar conexiones, calendario editorial, reglas simples y una lectura operativa basica del rendimiento.",
    packsByDepartment: {
      marketing: "FULL",
      ops: "STANDARD",
      support: "BASIC",
    },
    initialPricing: {
      currentMonthlyPrice: 79,
      recommendedMinPriceMonthly: 49,
      recommendedTargetPriceMonthly: 79,
      recommendedStretchPriceMonthly: 129,
    },
    aiProfile: {
      tier: "BALANCED",
      notes: "SocialFlow pilot profile with lightweight content assistance and operator-safe defaults.",
    },
    knowledgeSeeds: [
      {
        type: "BUSINESS_INFO",
        description: "SocialFlow centraliza cuentas, calendario editorial, reglas operativas y analitica inicial para equipos pequenos.",
      },
      {
        type: "MARKETING_POSITIONING",
        description: "Producto orientado a ritmo editorial, automatizaciones simples y visibilidad de engagement sin complejidad enterprise.",
      },
      {
        type: "FAQ",
        description: "Las conexiones sociales pueden ser demo o reales; las automatizaciones del piloto se modelan como reglas operativas recuperables.",
      },
    ],
    initialFeatures: [...SOCIALFLOW_MVP_FEATURES],
    interviewSummary: "Primer SaaS piloto producido por la fabrica canonica para validar Social, Tasks y Owner Control en shared runtime.",
    provisioning: {
      domains: {
        primarySubdomain: SOCIALFLOW_SLUG,
        primaryDomainType: "CUSTOM_DOMAIN_ALLOWED",
        customDomainRequested: input?.customDomainRequested ?? null,
      },
      stripe: {
        billingInterval: "MONTHLY",
        taxProfile: "ES_AUTONOMO",
        currency: "EUR",
      },
      ai: {
        tier: "BALANCED",
        preferredProviders: ["openai"],
      },
    },
  };
}
