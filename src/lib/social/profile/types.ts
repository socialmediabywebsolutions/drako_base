export type ChannelCompetitor = {
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
  // Prepared metrics fields
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

export type ChannelAsset = {
  id: string;
  channelId: string;
  kind: "pdf" | "docx" | "txt" | "image" | "brand_guide" | "catalog" | "post_example" | "screenshot" | "other";
  name: string;
  description: string | null;
  url: string | null; // In demo mode this can be a local path or placeholder
  mimeType: string | null;
  createdAt: string;
};

export type ChannelProfile = {
  id: string;
  tenantId: string;
  saasId: string;
  channelId: string;

  // A. Brand identity
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

  // B. Niche & topics
  niche: string;
  subniches: string[];
  mainTopics: string[];
  secondaryTopics: string[];
  viralThemes: string[];
  trendingTopics: string[];
  seasonalTopics: string[];
  forbiddenTopics: string[];
  allowedTopics: string[];

  // C. Audience
  audienceDescription: string;
  buyerPersona: string;
  painPoints: string[];
  desires: string[];
  objections: string[];
  awarenessLevel: string;
  audienceLanguage: string;
  audienceStyle: string;

  // D. Business / offer
  products: string[];
  services: string[];
  offers: string[];
  avgPrice: number | null;
  transformations: string[];
  differentiators: string[];
  primaryCTA: string;
  secondaryCTAs: string[];

  // E. SEO social / content
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

  // G. Market signals
  marketSignals: string[];
  opportunitySignals: string[];
  demandSignals: string[];
  audienceQuestions: string[];
  recurringObjections: string[];
  industryTrends: string[];

  // H. Restrictions
  prohibitedClaims: string[];
  bannedWords: string[];
  forbiddenAngles: string[];
  complianceNotes: string;
  brandSafetyRules: string;

  // I. Assets metadata summary (for quick access)
  assetSummary: string | null;

  createdAt: string;
  updatedAt: string;
};

export type ChannelKnowledgeSnapshot = {
  profile: ChannelProfile;
  competitors: ChannelCompetitor[];
  assets: ChannelAsset[];
};
