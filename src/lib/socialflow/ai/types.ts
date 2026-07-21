export type BrandProfile = {
  // Core brand & channel identity
  brandIdentity: string; // maps from ChannelProfile.brandName
  channelHandle: string; // maps from ChannelProfile.channelName
  shortDescription: string;
  longDescription: string;
  mission: string;
  valueProposition: string;
  toneOfVoice: string;
  personality: string;
  voiceInstruction: string; // "" = brand/third-person (default); non-empty = injected into prompts
  accountType?: "influencer" | "empresa" | null; // drives first- vs third-person voice in ContentGeneratorAgent
  ageRange?: string | null; // e.g. "25-35" — from ChannelProfile.ageRange, when set
  gender?: string | null; // e.g. "female" — from ChannelProfile.gender, when set

  // Audience & positioning
  niche: string;
  audience: string; // maps from audienceDescription
  buyerPersona: string;
  painPoints: string[];
  desires: string[];
  objections: string[];

  // Offer & differentiation
  services: string[];
  products: string[];
  offers: string[];
  differentiators: string[];
  primaryCTA: string;
  secondaryCTAs: string[];

  // Content & SEO
  baseKeywords: string[];
  priorityKeywords: string[];
  longTailKeywords: string[];
  baseHashtags: string[];
  priorityHashtags: string[];
  competitorHashtags: string[];
  contentPillars: string[];
  preferredFormats: string[];
  avoidedFormats: string[];

  // Topics & trends
  viralThemes: string[];
  trendingTopics: string[];
  seasonalTopics: string[];

  // Market & signals
  marketSignals: string[];
  opportunitySignals: string[];
  demandSignals: string[];

  // Restrictions & safety
  forbiddenTopics: string[];
  prohibitedClaims: string[];
  bannedWords: string[];
  forbiddenAngles: string[];
};

export type MarketResearch = {
  trends: string[];
  competitors: string[];
  contentGaps: string[];
};

export type KeywordCluster = {
  cluster: string;
  intent: "awareness" | "consideration" | "conversion";
  difficulty: "low" | "medium" | "high";
  trendScore: number;
  seasonality: string | null;
  contentAngles: string[];
  keywords: string[];
  hashtags: string[];
};

export type KeywordEngineOutput = {
  clusters: KeywordCluster[];
  evergreenHashtags: string[];
  trendingHashtags: string[];
  nicheHashtags: string[];
  viralHashtags: string[];
  campaignHashtags: string[];
};

export type KeywordResearch = {
  mainTopic: string;
  clusters: KeywordCluster[];
};

export type CompetitorInsights = {
  name: string;
  platform: "instagram" | "tiktok" | "linkedin" | "facebook" | "youtube" | "other";
  contentPatterns: string[];
  hashtagsUsed: string[];
  visualStyle: string;
  postingFrequency: string;
  engagementSignals: string[];
  strengths: string[];
  differentiationOpportunities: string[];
  // Advanced intelligence
  patterns?: string[];
  winningFormats?: string[];
  hookStyles?: string[];
  hashtagStrategies?: string[];
  weaknesses?: string[];
  opportunities?: string[];
};

export type StrategyItem = {
  id: string;
  dayOffset: number;
  theme: string;
  angle: string;
  format: "carousel" | "reel" | "single" | "story" | "article";
  callToAction: string;
};

export type ContentStrategy = {
  horizonDays: number;
  items: StrategyItem[];
};

export type GeneratedPostVariant = {
  id: string;
  text: string;
  hook: string;
  callToAction: string;
  recommendedPostType: "FEED" | "REEL" | "STORY";
};

export type GeneratedPost = {
  id: string;
  strategyItemId: string;
  variants: GeneratedPostVariant[];
};

export type OptimizedPost = {
  id: string;
  baseText: string;
  improvedText: string;
  hashtags: string[];
  tone: string;
};

export type ScheduledPostPlan = {
  id: string;
  postId: string;
  scheduledAt: string;
};

export type SocialAIPipelineResult = {
  profile: BrandProfile;
  research: KeywordResearch;
  keywords: KeywordResearch;
  competitors: CompetitorInsights[];
  strategy: ContentStrategy;
  generatedPosts: GeneratedPost[];
  optimizedPosts: OptimizedPost[];
  schedule: ScheduledPostPlan[];
  campaignId?: string;
};

export type SocialAIPipelineInput = {
  tenantId: string;
  saasId: string;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
  campaignId?: string;
  startDate?: string | null;
  endDate?: string | null;
  provider?: "INSTAGRAM" | "LINKEDIN" | "FACEBOOK_PAGE" | "TIKTOK" | "TWITTER_X";
  accountType?: "influencer" | "empresa" | null;
};
