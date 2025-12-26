export type SaasSocialProvider = "INSTAGRAM" | "FACEBOOK_PAGE" | "TIKTOK" | "WHATSAPP" | "OTHER";

export type SaasSocialAccountStatus = "DISCONNECTED" | "CONNECTED_DEMO" | "CONNECTED_REAL";

export type SaasSocialAccount = {
  id: string;
  tenantId: string;
  saasId: string;
  provider: SaasSocialProvider;
  handle: string | null;
  displayName: string | null;
  status: SaasSocialAccountStatus;
  authMeta: Record<string, unknown> | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SaasSocialCampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "FINISHED";

export type SaasSocialCampaign = {
  id: string;
  tenantId: string;
  saasId: string;
  name: string;
  objective: string;
  status: SaasSocialCampaignStatus;
  targetSegment: string;
  startDate: string | null;
  endDate: string | null;
  budgetEstimate: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasSocialContentType = "FEED" | "STORY" | "REEL" | "SHORT" | "CAROUSEL";

export type SaasSocialPostStatus = "DRAFT" | "SCHEDULED" | "POSTED" | "FAILED";

export type SaasSocialPost = {
  id: string;
  tenantId: string;
  saasId: string;
  campaignId: string | null;
  provider: SaasSocialProvider;
  contentType: SaasSocialContentType;
  title: string;
  body: string;
  imageHint: string | null;
  status: SaasSocialPostStatus;
  scheduledAt: string | null;
  postedAt: string | null;
  externalPostId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasSocialMetrics = {
  id: string;
  tenantId: string;
  saasId: string;
  postId: string;
  provider: SaasSocialProvider;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  leadsGenerated: number;
  capturedAt: string;
  metadata: Record<string, unknown> | null;
};

export type SocialCampaignIdea = {
  title: string;
  objective: string;
  targetSegment: string;
  suggestedServicesIds: string[];
  notes: string;
};

export type SocialPostSuggestion = {
  provider: SaasSocialProvider;
  contentType: SaasSocialContentType;
  title: string;
  body: string;
  imageHint: string;
  linkedServiceId: string | null;
  reason: string;
  stockStatus: "OK" | "LOW_STOCK" | "OUT_OF_STOCK";
  marginStatus: "OK" | "LOW_MARGIN" | "LOSS";
};

export type SocialCampaignPerformance = {
  campaignId: string;
  name: string;
  provider: string;
  postsCount: number;
  appointmentsCount: number;
  estimatedRevenue: number;
  averageMarginPercent?: number;
};

export type SocialPostPerformance = {
  postId: string;
  campaignId?: string;
  provider: string;
  title?: string;
  scheduledAt?: string | null;
  status: string;
  appointmentsCount: number;
  estimatedRevenue: number;
};

export type SocialConversionSnapshot = {
  totalAppointmentsFromSocial: number;
  totalRevenueFromSocial: number;
  topCampaigns: SocialCampaignPerformance[];
  topPosts: SocialPostPerformance[];
};
