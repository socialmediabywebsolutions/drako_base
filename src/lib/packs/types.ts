export type SaasPackVertical = "CLINIC" | "SALON" | "PET_GROOMING" | "LAUNDRY";

export type SaasCatalogVertical = SaasPackVertical;

export type SaasPackCatalogMeta = {
  vertical: SaasCatalogVertical;
  shortTagline: string;
  idealFor: string[];
  startingFromText: string;
  highlightBullets: string[];
  recommendedPlanId?: string;
};

export interface SaasPackDefinition {
  id: string;
  slug: string;
  label: string;
  vertical: SaasPackVertical;
  description: string;
  recommendedFeatureKeys: string[];
  recommendedBlueprintModuleKeys: string[];
  recommendedKnowledgeTags: string[];
  recommendedSocialCampaignSlugs?: string[];
  catalog?: SaasPackCatalogMeta;
}
