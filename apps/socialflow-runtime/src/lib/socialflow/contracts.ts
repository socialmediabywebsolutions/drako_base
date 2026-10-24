export type RuntimeSocialProvider = "LINKEDIN";

export type RuntimeSocialAccount = {
  id: string;
  tenantId: string;
  saasId: string;
  provider: RuntimeSocialProvider;
  handle: string | null;
  displayName: string | null;
  status: string;
  authMeta: Record<string, unknown> | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeSocialCampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "FINISHED" | "ARCHIVED";

export type RuntimeSocialCampaign = {
  id: string;
  tenantId: string;
  saasId: string;
  name: string;
  objective: string;
  status: RuntimeSocialCampaignStatus;
  targetSegment: string;
  startDate: string | null;
  endDate: string | null;
  budgetEstimate: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeSocialContentType = "FEED" | "STORY" | "REEL" | "SHORT" | "CAROUSEL";

export type RuntimeSocialPostStatus =
  | "IDEA"
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SCHEDULED"
  | "PUBLISHING"
  | "POSTED"
  | "PUBLISHED"
  | "FAILED";

export type RuntimeSocialPost = {
  id: string;
  tenantId: string;
  saasId: string;
  channelId: string | null;
  campaignId: string | null;
  provider: RuntimeSocialProvider;
  contentType: RuntimeSocialContentType;
  title: string;
  body: string;
  imageHint: string | null;
  status: RuntimeSocialPostStatus;
  scheduledAt: string | null;
  postedAt: string | null;
  externalPostId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeChannelCompetitor = {
  id: string;
  channelId: string;
  name: string;
  handle: string | null;
  platform: "instagram" | "tiktok" | "linkedin" | "facebook" | "youtube" | "x" | "other";
  niche: string | null;
  notes: string | null;
  visualStyle: string | null;
  postingFrequency: string | null;
  engagementNotes: string | null;
  strengths: string[];
  weaknesses: string[];
  differentiationOpportunities: string[];
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  reelPerformance: string | null;
  videoPerformance: string | null;
  bestFormats: string[];
  worstFormats: string[];
  postingCadence: string | null;
  engagementQuality: string | null;
  topContentThemes: string[];
  avgViews: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  avgShares: number | null;
  engagementRate: string | null;
  viralitySignals: string[];
  contentHooksUsed: string[];
  ctaPatterns: string[];
};

export type RuntimeChannelAsset = {
  id: string;
  channelId: string;
  kind: "pdf" | "docx" | "txt" | "image" | "brand_guide" | "catalog" | "post_example" | "screenshot" | "other";
  name: string;
  description: string | null;
  url: string | null;
  mimeType: string | null;
  createdAt: string;
};

export type RuntimeChannelProfile = {
  id: string;
  tenantId: string;
  saasId: string;
  channelId: string;
  brandName: string;
  channelName: string;
  shortDescription: string;
  longDescription: string;
  mission: string;
  valueProposition: string;
  toneOfVoice: string;
  personality: string;
  primaryLanguage: string;
  targetCountry: string;
  targetMarkets: string[];
  niche: string;
  subniches: string[];
  mainTopics: string[];
  secondaryTopics: string[];
  viralThemes: string[];
  trendingTopics: string[];
  seasonalTopics: string[];
  forbiddenTopics: string[];
  allowedTopics: string[];
  audienceDescription: string;
  buyerPersona: string;
  painPoints: string[];
  desires: string[];
  objections: string[];
  awarenessLevel: string;
  audienceLanguage: string;
  audienceStyle: string;
  products: string[];
  services: string[];
  offers: string[];
  avgPrice: number | null;
  transformations: string[];
  differentiators: string[];
  primaryCTA: string;
  secondaryCTAs: string[];
  baseKeywords: string[];
  priorityKeywords: string[];
  longTailKeywords: string[];
  baseHashtags: string[];
  priorityHashtags: string[];
  competitorHashtags: string[];
  contentPillars: string[];
  preferredFormats: string[];
  avoidedFormats: string[];
  postingFrequencyGoal: string;
  marketSignals: string[];
  opportunitySignals: string[];
  demandSignals: string[];
  audienceQuestions: string[];
  recurringObjections: string[];
  industryTrends: string[];
  prohibitedClaims: string[];
  bannedWords: string[];
  forbiddenAngles: string[];
  complianceNotes: string;
  brandSafetyRules: string;
  assetSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeChannelKnowledgeSnapshot = {
  profile: RuntimeChannelProfile;
  competitors: RuntimeChannelCompetitor[];
  assets: RuntimeChannelAsset[];
};

export type RuntimeCampaignUpsertInput = {
  id?: string;
  saasId: string;
  name: string;
  objective: string;
  status: RuntimeSocialCampaignStatus;
  targetSegment: string;
  startDate: string | null;
  endDate: string | null;
  budgetEstimate: number | null;
  notes: string | null;
};

export type RuntimePostUpsertInput = {
  id?: string;
  saasId: string;
  campaignId?: string | null;
  channelId?: string | null;
  provider: RuntimeSocialProvider;
  contentType: RuntimeSocialContentType;
  title: string;
  body: string;
  imageHint?: string | null;
  status: RuntimeSocialPostStatus;
  scheduledAt?: string | null;
  postedAt?: string | null;
  externalPostId?: string | null;
  metadata?: Record<string, unknown> | null;
};
