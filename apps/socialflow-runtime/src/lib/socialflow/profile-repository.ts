import { queryAll } from "../db/runtime-db";
import type { RuntimeChannelAsset, RuntimeChannelCompetitor, RuntimeChannelKnowledgeSnapshot, RuntimeChannelProfile } from "./contracts";
import {
  ensureRuntimeWorkspaceChannel,
  generateRuntimeId,
  getRuntimeProfileStoreRow,
  listRuntimeProfileStoreRows,
  nowIso,
  parseJsonRecord,
  resolveRuntimeSocialContext,
  SocialContextError,
  upsertRuntimeProfileStoreRow,
  upsertRuntimeStoreEntity,
} from "./runtime-repository-core";
import { resolveRuntimeSocialSaasSeedContract } from "./contracts/runtime-seed-contract";
import { normalizeRuntimeCompetitorPatch, normalizeRuntimeProfilePatch } from "./validators";

type ProfileStoreRow = {
  tenant_id: string;
  saas_id: string;
  channel_id: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
};

function buildDefaultProfile(input: {
  tenantId: string;
  saasId: string;
  channelId: string;
  brandName: string;
  channelName: string;
}) {
  const now = nowIso();
  return {
    id: generateRuntimeId("sf_profile"),
    tenantId: input.tenantId,
    saasId: input.saasId,
    channelId: input.channelId,
    brandName: input.brandName,
    channelName: input.channelName,
    shortDescription: `${input.brandName} social profile inside the isolated SocialFlow runtime.`,
    longDescription: `${input.brandName} keeps its content planning, publishing and profile state inside the new SocialFlow runtime boundary.`,
    mission: `Grow ${input.brandName} with consistent, tenant-scoped social execution.`,
    valueProposition: "AI-assisted social operations with runtime isolation.",
    toneOfVoice: "Direct, helpful, operational.",
    personality: "Practical growth operator.",
    primaryLanguage: "es",
    targetCountry: "ES",
    targetMarkets: [],
    niche: "Social media operations",
    subniches: [],
    mainTopics: [],
    secondaryTopics: [],
    viralThemes: [],
    trendingTopics: [],
    seasonalTopics: [],
    forbiddenTopics: [],
    allowedTopics: [],
    audienceDescription: "",
    buyerPersona: "",
    painPoints: [],
    desires: [],
    objections: [],
    awarenessLevel: "",
    audienceLanguage: "es",
    audienceStyle: "",
    products: [],
    services: [],
    offers: [],
    avgPrice: null,
    transformations: [],
    differentiators: [],
    primaryCTA: "Book now",
    secondaryCTAs: [],
    baseKeywords: [],
    priorityKeywords: [],
    longTailKeywords: [],
    baseHashtags: [],
    priorityHashtags: [],
    competitorHashtags: [],
    contentPillars: [],
    preferredFormats: [],
    avoidedFormats: [],
    postingFrequencyGoal: "",
    marketSignals: [],
    opportunitySignals: [],
    demandSignals: [],
    audienceQuestions: [],
    recurringObjections: [],
    industryTrends: [],
    prohibitedClaims: [],
    bannedWords: [],
    forbiddenAngles: [],
    complianceNotes: "",
    brandSafetyRules: "",
    assetSummary: null,
    createdAt: now,
    updatedAt: now,
  } satisfies RuntimeChannelProfile;
}

function buildDefaultCompetitor(channelId: string, patch: Partial<RuntimeChannelCompetitor>) {
  return {
    id: patch.id ?? generateRuntimeId("sf_competitor"),
    channelId,
    name: patch.name ?? "New competitor",
    handle: patch.handle ?? null,
    platform: patch.platform ?? "other",
    niche: patch.niche ?? null,
    notes: patch.notes ?? null,
    visualStyle: patch.visualStyle ?? null,
    postingFrequency: patch.postingFrequency ?? null,
    engagementNotes: patch.engagementNotes ?? null,
    strengths: patch.strengths ?? [],
    weaknesses: patch.weaknesses ?? [],
    differentiationOpportunities: patch.differentiationOpportunities ?? [],
    views: patch.views ?? null,
    likes: patch.likes ?? null,
    comments: patch.comments ?? null,
    shares: patch.shares ?? null,
    reelPerformance: patch.reelPerformance ?? null,
    videoPerformance: patch.videoPerformance ?? null,
    bestFormats: patch.bestFormats ?? [],
    worstFormats: patch.worstFormats ?? [],
    postingCadence: patch.postingCadence ?? null,
    engagementQuality: patch.engagementQuality ?? null,
    topContentThemes: patch.topContentThemes ?? [],
    avgViews: patch.avgViews ?? null,
    avgLikes: patch.avgLikes ?? null,
    avgComments: patch.avgComments ?? null,
    avgShares: patch.avgShares ?? null,
    engagementRate: patch.engagementRate ?? null,
    viralitySignals: patch.viralitySignals ?? [],
    contentHooksUsed: patch.contentHooksUsed ?? [],
    ctaPatterns: patch.ctaPatterns ?? [],
  } satisfies RuntimeChannelCompetitor;
}

async function resolveProfileContext(tenantId: string) {
  const seed = await resolveRuntimeSocialSaasSeedContract(tenantId);
  const saasId = seed?.slug ?? "socialflow";
  const context = await resolveRuntimeSocialContext({ tenantId, saasId });
  const channelId = await ensureRuntimeWorkspaceChannel(context);
  return { context, channelId, seed };
}

function readStoredPayload<T>(row: ProfileStoreRow | null): T | null {
  if (!row) return null;
  try {
    return JSON.parse(row.payload_json) as T;
  } catch {
    return null;
  }
}

export { SocialContextError };

export async function getRuntimeChannelKnowledgeFromDb(tenantId: string): Promise<RuntimeChannelKnowledgeSnapshot> {
  const { context, channelId, seed } = await resolveProfileContext(tenantId);
  const profileRow = await getRuntimeProfileStoreRow(context, channelId);
  let profile = readStoredPayload<RuntimeChannelProfile>(profileRow);

  if (!profile) {
    profile = buildDefaultProfile({
      tenantId: context.tenantId,
      saasId: context.saasId,
      channelId,
      brandName: seed?.name?.trim() || "SocialFlow",
      channelName: seed?.slug?.trim() ? `@${seed.slug.trim()}` : "@socialflow",
    });
    await upsertRuntimeProfileStoreRow(context, channelId, profile);
  }

  const competitorRows = await listRuntimeProfileStoreRows(context, "socialflow_runtime_channel_competitors");
  const competitors = competitorRows
    .filter((row) => row.channel_id === channelId)
    .map((row) => readStoredPayload<RuntimeChannelCompetitor>(row))
    .filter((value): value is RuntimeChannelCompetitor => Boolean(value));

  const assetRows = await listRuntimeProfileStoreRows(context, "socialflow_runtime_channel_assets");
  const assets = assetRows
    .filter((row) => row.channel_id === channelId)
    .map((row) => readStoredPayload<RuntimeChannelAsset>(row))
    .filter((value): value is RuntimeChannelAsset => Boolean(value));

  return { profile, competitors, assets };
}

export async function saveRuntimeChannelProfileInDb(tenantId: string, patchInput: unknown) {
  const patch = normalizeRuntimeProfilePatch(patchInput);
  if (!patch) {
    throw new SocialContextError("Profile payload must be an object.");
  }

  const current = await getRuntimeChannelKnowledgeFromDb(tenantId);
  const nextProfile: RuntimeChannelProfile = {
    ...current.profile,
    ...patch,
    tenantId: current.profile.tenantId,
    saasId: current.profile.saasId,
    channelId: current.profile.channelId,
    updatedAt: nowIso(),
  };

  const context = await resolveRuntimeSocialContext({
    tenantId: current.profile.tenantId,
    saasId: current.profile.saasId,
  });
  await upsertRuntimeProfileStoreRow(context, current.profile.channelId, nextProfile);
  return nextProfile;
}

export async function saveRuntimeChannelCompetitorInDb(tenantId: string, patchInput: unknown) {
  const patch = normalizeRuntimeCompetitorPatch(patchInput);
  if (!patch) {
    throw new SocialContextError("Competitor payload must be an object.");
  }

  const current = await getRuntimeChannelKnowledgeFromDb(tenantId);
  const existing = current.competitors.find((competitor) => competitor.id === patch.id) ?? null;
  const nextCompetitor: RuntimeChannelCompetitor = {
    ...(existing ?? buildDefaultCompetitor(current.profile.channelId, patch)),
    ...patch,
    id: patch.id ?? existing?.id ?? generateRuntimeId("sf_competitor"),
    channelId: current.profile.channelId,
  };

  const context = await resolveRuntimeSocialContext({
    tenantId: current.profile.tenantId,
    saasId: current.profile.saasId,
  });
  await upsertRuntimeStoreEntity(
    context,
    "socialflow_runtime_channel_competitors",
    nextCompetitor.id,
    current.profile.channelId,
    nextCompetitor as unknown as Record<string, unknown>,
  );

  return nextCompetitor;
}
