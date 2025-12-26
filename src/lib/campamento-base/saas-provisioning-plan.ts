import type { AiTier, SaasBlueprintDraft, SaasVerticalId } from "@/lib/campamento-base/saas-factory-types";
import type { SaasPricingRecommendation } from "@/lib/owner/pricing-engine";

function resolveDefaultAiTier(params: {
  verticalId: SaasVerticalId;
  marketingTier?: string;
  supportTier?: string;
}): AiTier {
  if (params.verticalId === "CRYPTO") return "PREMIUM";
  if (params.marketingTier === "FULL" || params.supportTier === "FULL") return "PREMIUM";
  if (params.marketingTier === "BASIC" && params.supportTier === "BASIC") return "COST_SAVER";
  return "BALANCED";
}

export function computeDefaultProvisioningForBlueprint(blueprint: SaasBlueprintDraft): SaasBlueprintDraft {
  const primarySubdomain = blueprint.provisioning?.domains.primarySubdomain ?? blueprint.proposedSlug;
  const billingInterval = blueprint.provisioning?.stripe.billingInterval ?? "MONTHLY";
  const taxProfile = blueprint.provisioning?.stripe.taxProfile ?? "ES_AUTONOMO";
  const currency = blueprint.provisioning?.stripe.currency ?? "EUR";
  const aiTier = blueprint.provisioning?.ai.tier
    ?? blueprint.aiProfile.tier
    ?? blueprint.campamentoBaseProfile?.aiProfile.preferredTier
    ?? resolveDefaultAiTier({
      verticalId: blueprint.verticalId,
      marketingTier: blueprint.packsByDepartment.marketing,
      supportTier: blueprint.packsByDepartment.support,
    });

  return {
    ...blueprint,
    aiProfile: {
      tier: aiTier,
      notes: blueprint.aiProfile.notes,
    },
    provisioning: {
      domains: {
        primarySubdomain,
        primaryDomainType: blueprint.provisioning?.domains.primaryDomainType ?? "CUSTOM_DOMAIN_ALLOWED",
        customDomainRequested: blueprint.provisioning?.domains.customDomainRequested ?? null,
      },
      stripe: {
        billingInterval,
        taxProfile,
        currency,
      },
      ai: {
        tier: aiTier,
        preferredProviders: blueprint.provisioning?.ai.preferredProviders ?? [],
      },
    },
  };
}

export function prepareStripePricingFromBlueprint(
  blueprint: SaasBlueprintDraft,
  pricingRecommendation?: SaasPricingRecommendation | null,
): SaasBlueprintDraft {
  const initialPricing = blueprint.initialPricing;
  const nextPricing = {
    ...initialPricing,
    estimatedVendorCostMonthly:
      initialPricing.estimatedVendorCostMonthly ?? pricingRecommendation?.estimatedVendorCostMonthly ?? null,
    recommendedMinPriceMonthly:
      initialPricing.recommendedMinPriceMonthly ?? pricingRecommendation?.recommendedMinPriceMonthly ?? null,
    recommendedTargetPriceMonthly:
      initialPricing.recommendedTargetPriceMonthly ?? pricingRecommendation?.recommendedTargetPriceMonthly ?? null,
    recommendedStretchPriceMonthly:
      initialPricing.recommendedStretchPriceMonthly ?? pricingRecommendation?.recommendedStretchPriceMonthly ?? null,
  };

  return {
    ...blueprint,
    initialPricing: nextPricing,
  };
}
