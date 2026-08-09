import type { SaasSocialContentType } from "@/lib/social-core/types";

export type SocialFlowClientObjective = "followers" | "engagement" | "leads" | "sales" | "saves" | "virality";

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
  // Objetivo configurado una vez en el perfil (ver ChannelProfile.clientObjective) — los
  // agentes de composición (ej. CarouselComposerAgent) lo usan para fijar el CTA del
  // último slide/frame sin depender de que la IA lo redacte cada vez.
  clientObjective?: SocialFlowClientObjective | null;

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
  // Gestionado por SeasonalityAgent (src/lib/socialflow/ai/agents/SeasonalityAgent.ts) —
  // ya no es un campo manual del formulario de perfil. seasonalTopics es el array
  // "themes" extraído del JSON de seasonalContext; seasonalContext es el JSON completo
  // (context/hooks/themes/cta_suggestions/avoid) serializado como string, listo para que
  // cada agente lo interpole tal cual en su prompt.
  seasonalTopics: string[];
  seasonalContext: string;

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

// Compartido entre SocialFlowOrchestrator.persistToDb (contentType real que se
// persiste) y SchedulerAgent (para saber a qué formato le aplica cada hora óptima) —
// deben usar la MISMA traducción, si divergieran SchedulerAgent podría optimizar para
// un content_type que luego no es el que realmente se guarda.
export const STRATEGY_FORMAT_TO_CONTENT_TYPE: Record<StrategyItem["format"], SaasSocialContentType> = {
  single: "FEED",
  carousel: "FEED",
  reel: "REEL",
  story: "STORY",
  article: "FEED",
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

// Local competitor intelligence (Google Maps-based) — independent from CompetitorInsights
// / CompetitorAgent above, which analyze social-content patterns rather than real nearby
// businesses. Produced by CompetitorIntelligenceAgent.
export type GooglePriceLevel =
  | "PRICE_LEVEL_UNSPECIFIED"
  | "PRICE_LEVEL_FREE"
  | "PRICE_LEVEL_INEXPENSIVE"
  | "PRICE_LEVEL_MODERATE"
  | "PRICE_LEVEL_EXPENSIVE"
  | "PRICE_LEVEL_VERY_EXPENSIVE";

export type LocalCompetitorProfile = {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: GooglePriceLevel | null;
  distanceKm: number;
};

export type CompetitorIntelligenceInput = {
  tenantId: string;
  saasId: string;
  radiusKm?: number; // default 5, see CompetitorIntelligenceAgent
};

export type CompetitorIntelligenceResult = {
  competitors: LocalCompetitorProfile[];
  report: string;
  geocodedAt: string;
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
