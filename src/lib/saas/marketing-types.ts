import type { MarketingPackDefinition, MarketingPackTier } from "@/lib/saas/marketing-packs";

export type SaasMarketingPlan = {
  id: string;
  tenantId: string;
  saasId: string;
  includedPostsPerMonth: number;
  includedCampaignsPerMonth: number;
  extraPostPrice: number;
  extraCampaignPrice: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasMarketingUsageSource = "AUTOPILOT" | "STAFF" | "IMPORT";

export type SaasMarketingUsage = {
  id: string;
  tenantId: string;
  saasId: string;
  periodMonth: number;
  periodYear: number;
  postsPublished: number;
  campaignsLaunched: number;
  source: SaasMarketingUsageSource;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasPaidAdsChannel = "GOOGLE_ADS" | "META_ADS" | "OTHER";

export type SaasPaidAdsSpend = {
  id: string;
  tenantId: string;
  saasId: string;
  periodMonth: number;
  periodYear: number;
  channel: SaasPaidAdsChannel;
  amount: number;
  currency: string;
  billedToClient: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasPaidAdsByChannel = {
  channel: SaasPaidAdsChannel;
  amount: number;
  currency: string;
};

export type SaasMarketingSnapshot = {
  saasId: string;
  periodMonth: number;
  periodYear: number;
  includedPostsPerMonth: number;
  postsPublishedThisMonth: number;
  includedCampaignsPerMonth: number;
  campaignsLaunchedThisMonth: number;
  usagePostsPercent: number;
  usageCampaignsPercent: number;
  isNearLimit: boolean;
  paidAdsTotalThisMonth: number;
  paidAdsByChannel: SaasPaidAdsByChannel[];
  currentPackTier: MarketingPackTier | null;
  currentPackDefinition: MarketingPackDefinition | null;
  recommendedPackTier: MarketingPackTier | null;
  recommendedPackDefinition: MarketingPackDefinition | null;
};
