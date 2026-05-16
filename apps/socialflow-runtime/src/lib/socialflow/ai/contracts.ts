export type RuntimeBrandProfile = {
  brandIdentity: string;
  channelHandle: string;
  shortDescription: string;
  longDescription: string;
  mission: string;
  valueProposition: string;
  toneOfVoice: string;
  personality: string;
  niche: string;
  audience: string;
  buyerPersona: string;
  painPoints: string[];
  desires: string[];
  objections: string[];
  services: string[];
  products: string[];
  offers: string[];
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
  viralThemes: string[];
  trendingTopics: string[];
  seasonalTopics: string[];
  marketSignals: string[];
  opportunitySignals: string[];
  demandSignals: string[];
  forbiddenTopics: string[];
  prohibitedClaims: string[];
  bannedWords: string[];
  forbiddenAngles: string[];
};

export type RuntimeMarketResearch = {
  trends: string[];
  competitors: string[];
  contentGaps: string[];
};

export type RuntimeKeywordCluster = {
  cluster: string;
  intent: "awareness" | "consideration" | "conversion";
  difficulty: "low" | "medium" | "high";
  trendScore: number;
  seasonality: string | null;
  contentAngles: string[];
  keywords: string[];
  hashtags: string[];
};

export type RuntimeKeywordEngineOutput = {
  clusters: RuntimeKeywordCluster[];
  evergreenHashtags: string[];
  trendingHashtags: string[];
  nicheHashtags: string[];
  viralHashtags: string[];
  campaignHashtags: string[];
};

export type RuntimeKeywordResearch = {
  mainTopic: string;
  clusters: RuntimeKeywordCluster[];
};

export type RuntimeCompetitorInsights = {
  name: string;
  platform: "instagram" | "tiktok" | "linkedin" | "facebook" | "youtube" | "x" | "other";
  contentPatterns: string[];
  hashtagsUsed: string[];
  visualStyle: string;
  postingFrequency: string;
  engagementSignals: string[];
  strengths: string[];
  differentiationOpportunities: string[];
  patterns: string[];
  winningFormats: string[];
  hookStyles: string[];
  hashtagStrategies: string[];
  weaknesses: string[];
  opportunities: string[];
};

export type RuntimeStrategyItem = {
  id: string;
  dayOffset: number;
  theme: string;
  angle: string;
  format: "carousel" | "reel" | "single" | "story" | "article";
  callToAction: string;
};

export type RuntimeContentStrategy = {
  horizonDays: number;
  items: RuntimeStrategyItem[];
};

export type RuntimeGeneratedPostVariant = {
  id: string;
  text: string;
  hook: string;
  callToAction: string;
};

export type RuntimeGeneratedPost = {
  id: string;
  strategyItemId: string;
  variants: RuntimeGeneratedPostVariant[];
};

export type RuntimeOptimizedPost = {
  id: string;
  baseText: string;
  improvedText: string;
  hashtags: string[];
  tone: string;
};

export type RuntimeScheduledPostPlan = {
  id: string;
  postId: string;
  scheduledAt: string;
};

export type RuntimeSocialAIPipelineInput = {
  tenantId: string;
  saasId: string;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
};

export type RuntimeTrendInsights = {
  trendingTopics: string[];
  viralAngles: string[];
  emergingPatterns: string[];
  shortFormOpportunities: string[];
  hookIdeas: string[];
};

export type RuntimeSocialAIPipelineResult = {
  profile: RuntimeBrandProfile;
  research: RuntimeKeywordResearch;
  keywords: RuntimeKeywordResearch;
  marketResearch: RuntimeMarketResearch;
  competitors: RuntimeCompetitorInsights[];
  strategy: RuntimeContentStrategy;
  generatedPosts: RuntimeGeneratedPost[];
  optimizedPosts: RuntimeOptimizedPost[];
  schedule: RuntimeScheduledPostPlan[];
  campaignId?: string;
  campaign?: {
    id: string;
    name: string;
    objective: string;
    status: string;
  };
};

export type RuntimeSinglePostGeneration = {
  profile: RuntimeBrandProfile;
  strategyItem: RuntimeStrategyItem;
  generated: RuntimeGeneratedPost;
  optimized: RuntimeOptimizedPost;
};
