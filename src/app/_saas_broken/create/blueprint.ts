import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import { normalizeCampamentoBaseProfileForBlueprint } from "@/lib/campamento-base/saas-factory-helpers";

export function createDefaultBlueprint(tenantId: string): SaasBlueprintDraft {
  return normalizeCampamentoBaseProfileForBlueprint({
    ownerTenantId: tenantId,
    saasName: "Nuevo SaaS",
    proposedSlug: "nuevo-saas",
    proposedSubdomain: "nuevo-saas",
    verticalId: "OTHER",
    summary: "Blueprint inicial definido por Campamento Base.",
    targetAudience: "Clientes del vertical seleccionado",
    mainProblem: "Operacion dispersa",
    mainGoal: "Eficiencia y crecimiento",
    packsByDepartment: {
      marketing: "STANDARD",
      accounting: "BASIC",
      support: "BASIC",
      emailIntake: "BASIC",
      ops: "BASIC",
      tax: "BASIC",
    },
    initialPricing: {
      currentMonthlyPrice: 0,
      estimatedVendorCostMonthly: null,
      recommendedMinPriceMonthly: null,
      recommendedTargetPriceMonthly: null,
      recommendedStretchPriceMonthly: null,
    },
    aiProfile: {
      tier: "BALANCED",
    },
    provisioning: {
      domains: {
        primarySubdomain: "nuevo-saas",
        primaryDomainType: "CUSTOM_DOMAIN_ALLOWED",
        customDomainRequested: null,
      },
      stripe: {
        billingInterval: "MONTHLY",
        taxProfile: "ES_AUTONOMO",
        currency: "EUR",
      },
      ai: {
        tier: "BALANCED",
      },
    },
  }, { applyDefaults: true });
}
