export type SaasSocialProvider =
  | "INSTAGRAM"
  | "FACEBOOK_PAGE"
  | "TIKTOK"
  | "WHATSAPP"
  | "TWITTER_X"
  | "OTHER"
  | "LINKEDIN";

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

export type SaasSocialChannel = {
  id: string;
  tenantId: string;
  saasId: string;
  name: string;
  provider: SaasSocialProvider;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
};

export type SaasSocialChannelIdeaStatus = "idea" | "approved" | "converted" | "discarded";

export type SaasSocialChannelIdea = {
  id: string;
  tenantId: string;
  saasId: string;
  channelId: string;
  title: string;
  angle: string | null;
  summary: string | null;
  status: SaasSocialChannelIdeaStatus;
  createdAt: string;
  updatedAt: string;
};

export type SaasSocialChannelKnowledge = {
  channelId: string;
  objective: string | null;
  audience: string | null;
  tone: string | null;
  keywords: string[];
  competitors: string[];
  sources: string[];
  updatedAt: string | null;
};

export type SaasSocialChannelSignals = {
  channelId: string;
  tenantId: string;
  saasId: string;
  topics: string[];
  activeKeywords: string[];
  trendNotes: string | null;
  watchedCompetitors: string[];
  watchedSources: string[];
  updatedAt: string;
};

export type SaasSocialCampaignStatus = "DRAFT" | "GENERATING" | "ACTIVE" | "PAUSED" | "FINISHED" | "ARCHIVED" | "FAILED";

// Objetivo específico de esta campaña — si está definido, sobrescribe el clientObjective
// del perfil (BrandProfile.clientObjective) solo para el contenido generado dentro de
// esta campaña. Ver SocialFlowOrchestrator.buildProfile().
export type CampaignObjective = "followers" | "engagement" | "leads" | "sales" | "saves" | "virality";

export type SaasSocialCampaign = {
  id: string;
  tenantId: string;
  saasId: string;
  name: string;
  // null/undefined = sin override, hereda el objetivo del perfil del cliente.
  objective?: CampaignObjective | null;
  status: SaasSocialCampaignStatus;
  targetSegment: string;
  startDate: string | null;
  endDate: string | null;
  budgetEstimate: number | null;
  notes: string | null;
  // Planned format-mix counters (Fase 1 — ver migrations/0200_saas_social_campaigns_format_mix.sql).
  // Optional so every existing object literal that builds this type keeps compiling unchanged;
  // the D1 column has DEFAULT 0, so absent here just means "no planned mix set yet".
  postCount?: number;
  reelCount?: number;
  historiaCount?: number;
  // Fase 5 — ver migrations/0201_saas_social_campaigns_carousel_count.sql. Modelo
  // distinto al resto: 1 carrusel = N fotos agrupadas (no 1 foto = 1 post) — ver
  // campaigns/[id]/photos/route.ts.
  carouselCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type SaasSocialContentType = "FEED" | "STORY" | "REEL" | "SHORT" | "CAROUSEL";

export type SaasSocialPostStatus =
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

export type SaasSocialPost = {
  id: string;
  tenantId: string;
  saasId: string;
  channelId?: string | null;
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
  analyticsMeta?: AnalyticsMeta;
  // AUTO = created by SocialFlowOrchestrator (botón central "modo automático");
  // MANUAL = created through the vertical menu (Post/Reel/Historia/Carrusel).
  // Optional for backward compat with any code path constructing this type without
  // a DB row (e.g. tests) — DB rows always have it (DEFAULT 'AUTO', see migration 0211).
  creationMode?: "AUTO" | "MANUAL";
  createdAt: string;
  updatedAt: string;
};

export type SocialProviderName = "linkedin" | "instagram" | "facebook" | "x";

export type SocialProviderConfig = {
  provider: SocialProviderName;
  enabled: boolean;
  supportsScheduling: boolean;
  supportsEditingAfterPublish: boolean;
  maxCharacters?: number | null;
  maxHashtags?: number | null;
  mediaRequirements?: string | null;
};

export type SocialPostPublishState = {
  postId: string;
  provider: SocialProviderName;
  status: "PENDING" | "QUEUED" | "PUBLISHED" | "FAILED";
  externalPostId: string | null;
  publishedUrl: string | null;
  publishedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  rawResponse: Record<string, unknown> | null;
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
  leadsGenerated: number;
  publishedPosts: number;
  topProvider: SaasSocialProvider | null;
  averageEngagementPerPublishedPost: number;
};

export type SocialAnalyticsSnapshot = {
  last7Days: SocialAnalyticsWindow;
  last30Days: SocialAnalyticsWindow;
};

// One point per captured account-level snapshot (saas_social_metrics rows with
// post_id = "account:<id>", written every 4h by processInstagramMetrics — append-only,
// never overwritten) — the real historical source for a followers-evolution chart.
export type FollowerHistoryPoint = {
  capturedAt: string;
  followersCount: number;
};

export type SocialInsightsWeeklyFormatPoint = {
  weekStart: string;
  weekLabel: string;
  FEED: number;
  REEL: number;
  STORY: number;
  CAROUSEL: number;
};

export type SocialInsightsTopPost = {
  id: string;
  title: string;
  body: string;
  imageHint: string | null;
  contentType: SaasSocialContentType;
  likes: number;
  comments: number;
  saved: number;
  engagement: number;
  postedAt: string | null;
};

export type SocialInsightsSnapshot = {
  summary: {
    reach30d: number;
    saved30d: number;
    plays30d: number;
    engagementRate: number;
    currentFollowers: number | null;
    followerGrowthThisMonth: number | null;
  };
  weeklyFormatBreakdown: SocialInsightsWeeklyFormatPoint[];
  // Mismo shape que weeklyFormatBreakdown (reach) — likes+comments y plays por formato,
  // en los mismos 4 buckets semanales, para los gráficos correspondientes en Insights.
  engagementByFormatBreakdown: SocialInsightsWeeklyFormatPoint[];
  playsByFormatBreakdown: SocialInsightsWeeklyFormatPoint[];
  followerHistory: FollowerHistoryPoint[];
  topPosts: SocialInsightsTopPost[];
};

// Tarjetas adicionales del dashboard (Fix 5) — actividad real del mes en curso, aparte
// del resumen de producto (SocialProductSummary) que ya usan las 4 tarjetas existentes.
export type SocialActivitySummary = {
  postsThisMonth: { FEED: number; REEL: number; STORY: number; CAROUSEL: number };
  totalLikesThisMonth: number;
  totalCommentsThisMonth: number;
  currentFollowers: number | null;
};

export type SocialLiveAnalyticsSummary = {
  totalEligibleLivePosts: number;
  healthyPosts: number;
  failedPosts: number;
  noLiveAnalyticsYetPosts: number;
  lastHealthyLiveSyncAt: string | null;
  healthySyncFreshnessStatus: "FRESH" | "AGING" | "NOT_AVAILABLE";
  healthySyncNeedsRefresh: boolean;
  resolvedRecently: boolean;
  resolvedRecentlyCount: number;
  lastResolvedAt: string | null;
  lastWorkspaceSyncAt: string | null;
  status: "Healthy" | "Needs attention" | "No live analytics yet";
  recommendation: string;
  recentActivity: SocialAnalyticsActivity[];
  recentIncidents: SocialAnalyticsIncident[];
};

export type SocialAnalyticsActivity = {
  postId: string;
  postTitle: string;
  provider: SaasSocialProvider;
  lastFetchedAt: string;
  state: "success" | "fallback" | "error" | "resolved" | string;
  summary: string;
  reviewed: boolean;
  manualReviewAt?: string | null;
  analyticsSource?: string | null;
  lastRefreshStatus?: "success" | "fallback" | "error" | null;
  lastRefreshErrorMessage?: string | null;
  lastRefreshErrorCode?: string | null;
  lastRefreshAt?: string | null;
  lastFetchedAtDisplay?: string | null;
  manualReviewNote?: string | null;
  recommendation?: string | null;
  externalPostId?: string | null;
};

export type SocialAnalyticsIncident = {
  id: string;
  postId: string;
  state: "error" | "resolved" | "success" | "fallback" | string;
  summary: string;
  createdAt: string;
  lastFetchedAt?: string | null;
  postTitle?: string | null;
  reviewed?: boolean;
  manualReviewAt?: string | null;
  lastRefreshErrorMessage?: string | null;
  lastRefreshErrorCode?: string | null;
  recommendation?: string | null;
  manualReviewNote?: string | null;
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
    steps: { key?: string; label?: string; hint?: string; completed?: boolean }[];
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
  activeRules: SocialAutomationRuleSummary[];
  operations: {
    status: string;
    headline: string;
    criticalActions: string[];
    nextMilestones: string[];
    counts: Record<string, number>;
  };
  transparency: { key: string; label: string; message: string }[];
};

export type SocialAutomationRuleSummary = {
  id: string;
  title: string;
  description?: string;
  scope?: {
    providers?: string[];
  } | null;
};

export type SocialCalendarDay = {
  date: string;
  posts: SaasSocialPost[];
};

export type SocialCalendarSnapshot = {
  days: SocialCalendarDay[];
  upcomingPosts: SaasSocialPost[];
};

export type AnalyticsMeta = {
  source: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  reach: number;
  saved: number;
  engagement: number;
  lastFetchedAt?: string | null;
  lastRefreshStatus?: "success" | "fallback" | "error" | null;
  lastRefreshErrorMessage?: string | null;
  lastRefreshErrorCode?: string | null;
};
