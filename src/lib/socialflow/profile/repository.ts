import { exportDemoTenantState, replaceDemoTenantState } from "@/lib/admin/demo-data";
import type { CompetitorInsights } from "@/lib/socialflow/ai/types";
import type { ChannelAsset, ChannelCompetitor, ChannelKnowledgeSnapshot, ChannelProfile } from "@/lib/socialflow/profile/types";

const DEMO_CHANNEL_ID = "default_socialflow_channel";

function nowIso() {
  return new Date().toISOString();
}

function ensureDemoKnowledgeSnapshot(tenantId: string): ChannelKnowledgeSnapshot {
  const state = exportDemoTenantState(tenantId) as any;
  const existing: ChannelKnowledgeSnapshot | undefined = state.socialflowKnowledge;

  if (existing && existing.profile) {
    return existing;
  }

  const baseProfile: ChannelProfile = {
    id: DEMO_CHANNEL_ID,
    tenantId,
    saasId: "socialflow",
    channelId: DEMO_CHANNEL_ID,

    brandName: "Demo SocialFlow Brand",
    channelName: "@demo_socialflow",
    shortDescription: "AI-assisted social media for salons & clinics.",
    longDescription:
      "This is a demo profile for SocialFlow. Configure your real brand profile here to train the AI agents.",
    mission: "Help owners grow with consistent, high-quality content.",
    valueProposition: "Done-with-you content planning and publishing.",
    toneOfVoice: "Friendly, expert, concrete.",
    personality: "Helpful strategist and operator.",
    primaryLanguage: "es",
    targetCountry: "ES",
    targetMarkets: ["beauty", "health", "aesthetics"],

    niche: "Social media for salons and clinics",
    subniches: ["aesthetic clinics", "hair salons"],
    mainTopics: ["client acquisition", "retention", "automation"],
    secondaryTopics: ["pricing", "packaging"],
    viralThemes: ["before/after", "behind the scenes"],
    trendingTopics: ["AI for salons"],
    seasonalTopics: ["Black Friday", "summer campaigns"],
    forbiddenTopics: ["politics", "religion"],
    allowedTopics: ["business", "marketing", "mindset"],

    audienceDescription: "Owners and managers of salons and clinics.",
    buyerPersona: "Time-poor owner who wants marketing done right.",
    painPoints: ["no time to post", "no clear strategy"],
    desires: ["more bookings", "better clients"],
    objections: ["I've tried agencies before"],
    awarenessLevel: "problem-aware",
    audienceLanguage: "es",
    audienceStyle: "direct, practical",

    products: ["SocialFlow pilot"],
    services: ["done-with-you content ops"],
    offers: ["4-week pilot"],
    avgPrice: null,
    transformations: ["less time on content", "more consistent posting"],
    differentiators: ["AI-assisted ops", "integrated with inbox"],
    primaryCTA: "Book a strategy session",
    secondaryCTAs: ["Join waitlist"],

    baseKeywords: ["social media", "salons", "clinics"],
    priorityKeywords: ["social media automation"],
    longTailKeywords: ["social media for clinics in Spain"],
    baseHashtags: ["#socialflow", "#salonowner"],
    priorityHashtags: ["#clinicgrowth"],
    competitorHashtags: ["#marketingagency"],
    contentPillars: ["education", "authority", "social proof"],
    preferredFormats: ["carousel", "reel"],
    avoidedFormats: ["long-form lives"],
    postingFrequencyGoal: "3-5 posts/week",

    marketSignals: ["high competition", "owners overwhelmed"],
    opportunitySignals: ["few players in automation"],
    demandSignals: ["many questions about marketing"],
    audienceQuestions: ["how often should I post?"],
    recurringObjections: ["no time", "no ideas"],
    industryTrends: ["AI assistants", "short-form video"],

    prohibitedClaims: ["guaranteed medical results"],
    bannedWords: ["miracle"],
    forbiddenAngles: ["shaming body image"],
    complianceNotes: "Follow local advertising rules for medical services.",
    brandSafetyRules: "No sensitive health promises.",

    assetSummary: null,

    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const snapshot: ChannelKnowledgeSnapshot = {
    profile: baseProfile,
    competitors: [],
    assets: [],
  };

  const nextState = {
    ...state,
    socialflowKnowledge: snapshot,
  };

  replaceDemoTenantState(tenantId, nextState);
  return snapshot;
}

export function getChannelKnowledge(tenantId: string): ChannelKnowledgeSnapshot {
  return ensureDemoKnowledgeSnapshot(tenantId);
}

export function getChannelProfile(tenantId: string): ChannelProfile {
  return ensureDemoKnowledgeSnapshot(tenantId).profile;
}

export function upsertChannelProfile(tenantId: string, patch: Partial<ChannelProfile>): ChannelProfile {
  const current = ensureDemoKnowledgeSnapshot(tenantId);
  const updated: ChannelProfile = {
    ...current.profile,
    ...patch,
    id: current.profile.id,
    tenantId,
    saasId: current.profile.saasId,
    channelId: current.profile.channelId,
    updatedAt: nowIso(),
  };

  const next: ChannelKnowledgeSnapshot = {
    ...current,
    profile: updated,
  };

  const state = exportDemoTenantState(tenantId) as any;
  replaceDemoTenantState(tenantId, { ...state, socialflowKnowledge: next });

  return updated;
}

export function saveCompetitorInsights(tenantId: string, insights: CompetitorInsights[]): ChannelCompetitor[] {
  const current = ensureDemoKnowledgeSnapshot(tenantId);

  const saved: ChannelCompetitor[] = insights.map((insight) => {
    const nameKey = insight.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const id = `intel_${nameKey}`;

    const competitorPatch: Partial<ChannelCompetitor> = {
      id,
      name: insight.name,
      platform: insight.platform,
      visualStyle: insight.visualStyle,
      postingFrequency: insight.postingFrequency,
      strengths: insight.strengths,
      weaknesses: insight.weaknesses ?? [],
      differentiationOpportunities: insight.differentiationOpportunities,
      topContentThemes: insight.contentPatterns,
      engagementNotes: insight.engagementSignals.join(" | "),
      bestFormats: insight.winningFormats ?? [],
      viralitySignals: insight.patterns ?? [],
      contentHooksUsed: insight.hookStyles ?? [],
      ctaPatterns: insight.opportunities ?? [],
      views: null,
      likes: null,
      comments: null,
      shares: null,
      reelPerformance: null,
      videoPerformance: null,
      worstFormats: [],
      postingCadence: insight.postingFrequency,
      engagementQuality: null,
      avgViews: null,
      avgLikes: null,
      avgComments: null,
      avgShares: null,
      engagementRate: null,
    };

    return upsertChannelCompetitor(tenantId, competitorPatch);
  });

  const state = exportDemoTenantState(tenantId) as any;
  const snapshot: ChannelKnowledgeSnapshot = ensureDemoKnowledgeSnapshot(tenantId);
  const next: ChannelKnowledgeSnapshot = {
    ...snapshot,
    competitors: saved,
  };
  replaceDemoTenantState(tenantId, { ...state, socialflowKnowledge: next });

  return saved;
}

export function listChannelCompetitors(tenantId: string): ChannelCompetitor[] {
  return ensureDemoKnowledgeSnapshot(tenantId).competitors;
}

export function upsertChannelCompetitor(tenantId: string, competitor: Partial<ChannelCompetitor>): ChannelCompetitor {
  const current = ensureDemoKnowledgeSnapshot(tenantId);
  const id = competitor.id ?? `comp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const existingIndex = current.competitors.findIndex((c) => c.id === id);

  const base: ChannelCompetitor = existingIndex >= 0
    ? current.competitors[existingIndex]
    : {
        id,
        channelId: current.profile.channelId,
        name: competitor.name ?? "New competitor",
        handle: competitor.handle ?? null,
        platform: competitor.platform ?? "instagram",
        niche: competitor.niche ?? null,
        notes: competitor.notes ?? null,
        visualStyle: competitor.visualStyle ?? null,
        postingFrequency: competitor.postingFrequency ?? null,
        engagementNotes: competitor.engagementNotes ?? null,
        strengths: competitor.strengths ?? [],
        weaknesses: competitor.weaknesses ?? [],
        differentiationOpportunities: competitor.differentiationOpportunities ?? [],
        views: competitor.views ?? null,
        likes: competitor.likes ?? null,
        comments: competitor.comments ?? null,
        shares: competitor.shares ?? null,
        reelPerformance: competitor.reelPerformance ?? null,
        videoPerformance: competitor.videoPerformance ?? null,
        bestFormats: competitor.bestFormats ?? [],
        worstFormats: competitor.worstFormats ?? [],
        postingCadence: competitor.postingCadence ?? null,
        engagementQuality: competitor.engagementQuality ?? null,
        topContentThemes: competitor.topContentThemes ?? [],
        avgViews: competitor.avgViews ?? null,
        avgLikes: competitor.avgLikes ?? null,
        avgComments: competitor.avgComments ?? null,
        avgShares: competitor.avgShares ?? null,
        engagementRate: competitor.engagementRate ?? null,
        viralitySignals: competitor.viralitySignals ?? [],
        contentHooksUsed: competitor.contentHooksUsed ?? [],
        ctaPatterns: competitor.ctaPatterns ?? [],
      };

  const updated: ChannelCompetitor = {
    ...base,
    ...competitor,
    id,
    channelId: base.channelId,
  };

  const nextCompetitors = [...current.competitors];
  if (existingIndex >= 0) {
    nextCompetitors[existingIndex] = updated;
  } else {
    nextCompetitors.push(updated);
  }

  const next: ChannelKnowledgeSnapshot = {
    ...current,
    competitors: nextCompetitors,
  };

  const state = exportDemoTenantState(tenantId) as any;
  replaceDemoTenantState(tenantId, { ...state, socialflowKnowledge: next });

  return updated;
}

export function listChannelAssets(tenantId: string): ChannelAsset[] {
  return ensureDemoKnowledgeSnapshot(tenantId).assets;
}

export function saveChannelAssetMetadata(tenantId: string, asset: Partial<ChannelAsset>): ChannelAsset {
  const current = ensureDemoKnowledgeSnapshot(tenantId);
  const id = asset.id ?? `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const base: ChannelAsset = {
    id,
    channelId: current.profile.channelId,
    kind: asset.kind ?? "other",
    name: asset.name ?? "New asset",
    description: asset.description ?? null,
    url: asset.url ?? null,
    mimeType: asset.mimeType ?? null,
    createdAt: asset.createdAt ?? nowIso(),
  };

  const existingIndex = current.assets.findIndex((a) => a.id === id);
  const updated: ChannelAsset = {
    ...base,
    ...asset,
    id,
    channelId: base.channelId,
  };

  const nextAssets = [...current.assets];
  if (existingIndex >= 0) {
    nextAssets[existingIndex] = updated;
  } else {
    nextAssets.push(updated);
  }

  const next: ChannelKnowledgeSnapshot = {
    ...current,
    assets: nextAssets,
  };

  const state = exportDemoTenantState(tenantId) as any;
  replaceDemoTenantState(tenantId, { ...state, socialflowKnowledge: next });

  return updated;
}
