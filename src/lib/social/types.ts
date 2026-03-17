export type SaasSocialProvider = "INSTAGRAM" | "FACEBOOK_PAGE" | "TIKTOK" | "WHATSAPP" | "TWITTER_X" | "OTHER" | "LINKEDIN";

export type SaasSocialAccountStatus =
  | "DISCONNECTED"
  | "CONNECTED_DEMO"
  | "CONNECTED_REAL"
  | "INVALID_CREDENTIALS"
  | "PENDING_REAL"
  | "NEEDS_RECONNECTION";

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

export type SaasSocialCampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "FINISHED" | "ARCHIVED";

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

export type SaasSocialPostStatus = "DRAFT" | "SCHEDULED" | "POSTED" | "PUBLISHED" | "FAILED";

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

export type SocialAnalyticsWindow = {
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagement: number;
  publishedPosts: number;
  topProvider: SaasSocialProvider | null;
  averageEngagementPerPublishedPost: number;
};

export type SocialAnalyticsSnapshot = {
  last7Days: SocialAnalyticsWindow;
  last30Days: SocialAnalyticsWindow;
};

export type SocialLiveAnalyticsSummary = {
  totalEligibleLivePosts: number;
  healthyPosts: number;
  failedPosts: number;
  noLiveAnalyticsYetPosts: number;
  lastHealthyLiveSyncAt: string | null;
  healthySyncFreshnessStatus: string;
  healthySyncNeedsRefresh: boolean;
  resolvedRecently: boolean;
  resolvedRecentlyCount: number;
  lastResolvedAt: string | null;
  lastWorkspaceSyncAt: string | null;
  status: string;
  recommendation: string;
  recentActivity: SocialAnalyticsActivity[];
  recentIncidents: SocialAnalyticsIncident[];
};

export type SocialAnalyticsActivity = {
  postId: string;
  postTitle: string;
  provider: SaasSocialProvider;
  lastFetchedAt: string;
  state: string;
  summary: string;
  reviewed: boolean;
  manualReviewAt?: string | null;
  analyticsSource?: string | null;
  lastRefreshStatus?: string | null;
  externalPostId?: string | null;
};

export type SocialAnalyticsIncident = {
  id: string;
  postId: string;
  state: string;
  summary: string;
  createdAt: string;
};

export type SocialProductSummary = {
  presentation: {
    demoStage: string;
    stageLabel: string;
    confidenceNote: string;
  };
  readiness: {
    stage: string;
    label: string;
    readyNow: string[];
    simulatedAreas: string[];
    pilotNotes: string[];
  };
  onboarding: {
    completedSteps: number;
    totalSteps: number;
    progressPercent: number;
    nextAction: string;
    steps: unknown[];
  };
  overview: {
    connectedAccounts: number;
    activeCampaigns: number;
    scheduledPostsThisWeek: number;
    publishedPostsLast30Days: number;
    engagementLast30Days: number;
  };
  highlights: {
    draftPosts: number;
    upcomingPosts: number;
    archivedCampaigns: number;
  };
  analytics: SocialAnalyticsSnapshot;
  analyticsHealth: SocialLiveAnalyticsSummary;
  activeRules: unknown[];
  operations: {
    status: string;
    headline: string;
    criticalActions: string[];
    nextMilestones: string[];
    counts: Record<string, number>;
  };
  transparency: { key: string; label: string; message: string }[];
};
