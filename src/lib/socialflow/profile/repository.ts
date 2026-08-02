import type { CompetitorInsights, SocialFlowClientObjective } from "@/lib/socialflow/ai/types";
import { resolveSocialContext, SocialContextError } from "@/lib/socialflow/repository";
import type { ChannelAsset, ChannelCompetitor, ChannelKnowledgeSnapshot, ChannelProfile } from "@/lib/socialflow/profile/types";

const SOCIALFLOW_PROFILE_TABLE = "socialflow_profiles";
const DEFAULT_SAAS_ID = "socialflow";
const DEFAULT_CHANNEL_ID = "socialflow_primary_channel";

const PROFILE_COLUMNS = [
  "id",
  "tenant_id",
  "saas_id",
  "display_name",
  "brand_name",
  "business_type",
  "website_url",
  "description",
  "tone",
  "audience",
  "goals_json",
  "metadata_json",
  "age_range",
  "gender",
  "growth_goal_followers",
  "growth_goal_timeline",
  "content_style",
  "posting_frequency",
  "client_objective",
  "contact_email",
  "created_at",
  "updated_at",
].join(", ");

type ProfileRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  display_name: string | null;
  brand_name: string | null;
  business_type: string | null;
  website_url: string | null;
  description: string | null;
  tone: string | null;
  audience: string | null;
  goals_json: string | null;
  metadata_json: string | null;
  age_range: string | null;
  gender: string | null;
  growth_goal_followers: number | null;
  growth_goal_timeline: string | null;
  content_style: string | null;
  posting_frequency: number | null;
  client_objective: string | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileMetadata = {
  profile?: Partial<ChannelProfile>;
  competitors?: ChannelCompetitor[];
  assets?: ChannelAsset[];
};

const STRING_PROFILE_KEYS: Array<keyof ChannelProfile> = [
  "brandName",
  "channelName",
  "websiteUrl",
  "shortDescription",
  "longDescription",
  "mission",
  "valueProposition",
  "toneOfVoice",
  "personality",
  "primaryLanguage",
  "targetCountry",
  "niche",
  "audienceDescription",
  "buyerPersona",
  "awarenessLevel",
  "audienceLanguage",
  "audienceStyle",
  "primaryCTA",
  "postingFrequencyGoal",
  "complianceNotes",
  "brandSafetyRules",
];

const ARRAY_PROFILE_KEYS: Array<keyof ChannelProfile> = [
  "activeSocialNetworks",
  "targetMarkets",
  "subniches",
  "mainTopics",
  "secondaryTopics",
  "viralThemes",
  "trendingTopics",
  "seasonalTopics",
  "forbiddenTopics",
  "allowedTopics",
  "painPoints",
  "desires",
  "objections",
  "products",
  "services",
  "offers",
  "transformations",
  "differentiators",
  "secondaryCTAs",
  "baseKeywords",
  "priorityKeywords",
  "longTailKeywords",
  "baseHashtags",
  "priorityHashtags",
  "competitorHashtags",
  "contentPillars",
  "preferredFormats",
  "avoidedFormats",
  "marketSignals",
  "opportunitySignals",
  "demandSignals",
  "audienceQuestions",
  "recurringObjections",
  "industryTrends",
  "prohibitedClaims",
  "bannedWords",
  "forbiddenAngles",
];

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized ? normalized : null;
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const VALID_CLIENT_OBJECTIVES = new Set<SocialFlowClientObjective>(["followers", "engagement", "leads", "sales", "saves"]);

function normalizeClientObjective(value: unknown): SocialFlowClientObjective | null {
  const normalized = normalizeNullableString(value);
  return normalized && VALID_CLIENT_OBJECTIVES.has(normalized as SocialFlowClientObjective)
    ? (normalized as SocialFlowClientObjective)
    : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function parseJsonRecord(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function serializeJsonRecord(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}

const PERSONA_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: "age_range", ddl: "TEXT" },
  { name: "gender", ddl: "TEXT" },
  { name: "growth_goal_followers", ddl: "INTEGER" },
  { name: "growth_goal_timeline", ddl: "TEXT" },
  { name: "content_style", ddl: "TEXT" },
  { name: "posting_frequency", ddl: "INTEGER" },
  { name: "client_objective", ddl: "TEXT" },
  { name: "contact_email", ddl: "TEXT" },
];

async function ensurePersonaColumns(db: D1Database): Promise<void> {
  const { results } = await db.prepare(`PRAGMA table_info('${SOCIALFLOW_PROFILE_TABLE}')`).all<{ name: string }>();
  const existing = new Set((results ?? []).map((column) => column.name));
  for (const column of PERSONA_COLUMNS) {
    if (!existing.has(column.name)) {
      await db.prepare(`ALTER TABLE ${SOCIALFLOW_PROFILE_TABLE} ADD COLUMN ${column.name} ${column.ddl}`).run();
    }
  }
}

async function ensureProfileTable(db: D1Database) {
  await Promise.all([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS ${SOCIALFLOW_PROFILE_TABLE} (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        saas_id TEXT NOT NULL,
        display_name TEXT,
        brand_name TEXT,
        business_type TEXT,
        website_url TEXT,
        description TEXT,
        tone TEXT,
        audience TEXT,
        goals_json TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(tenant_id, saas_id)
      )`,
    ).run(),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_${SOCIALFLOW_PROFILE_TABLE}_tenant_saas
       ON ${SOCIALFLOW_PROFILE_TABLE} (tenant_id, saas_id)`,
    ).run(),
  ]);
  await ensurePersonaColumns(db);
}

function generateId(prefix: string) {
  try {
    if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  } catch {
    // ignore and fallback
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildEmptyProfile(tenantId: string, saasId: string): ChannelProfile {
  const now = nowIso();
  return {
    id: generateId("sf_profile"),
    tenantId,
    saasId,
    channelId: DEFAULT_CHANNEL_ID,
    brandName: "",
    channelName: "",
    websiteUrl: "",
    activeSocialNetworks: [],
    onboardingCompletedAt: null,
    shortDescription: "",
    longDescription: "",
    mission: "",
    valueProposition: "",
    toneOfVoice: "",
    personality: "",
    primaryLanguage: "",
    targetCountry: "",
    targetMarkets: [],
    niche: "",
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
    audienceLanguage: "",
    audienceStyle: "",
    products: [],
    services: [],
    offers: [],
    avgPrice: null,
    transformations: [],
    differentiators: [],
    primaryCTA: "",
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
    ageRange: null,
    gender: null,
    growthGoalFollowers: null,
    growthGoalTimeline: null,
    contentStyle: null,
    postingFrequency: null,
    clientObjective: null,
    contactEmail: null,
    createdAt: now,
    updatedAt: now,
  };
}

function mergeProfile(base: ChannelProfile, patch: Partial<ChannelProfile>): ChannelProfile {
  const next: ChannelProfile = { ...base };
  const nextRecord = next as unknown as Record<string, unknown>;
  const patchRecord = patch as unknown as Record<string, unknown>;

  for (const key of STRING_PROFILE_KEYS) {
    if (key in patch) {
      nextRecord[key] = normalizeString(patchRecord[key]);
    }
  }
  for (const key of ARRAY_PROFILE_KEYS) {
    if (key in patch) {
      nextRecord[key] = normalizeStringArray(patchRecord[key]);
    }
  }

  if ("avgPrice" in patch) {
    next.avgPrice = typeof patch.avgPrice === "number" && Number.isFinite(patch.avgPrice) ? patch.avgPrice : null;
  }
  if ("assetSummary" in patch) {
    next.assetSummary = normalizeNullableString(patch.assetSummary);
  }
  if ("onboardingCompletedAt" in patch) {
    next.onboardingCompletedAt = normalizeNullableString(patch.onboardingCompletedAt);
  }
  if ("ageRange" in patch) {
    next.ageRange = normalizeNullableString(patch.ageRange);
  }
  if ("gender" in patch) {
    next.gender = normalizeNullableString(patch.gender);
  }
  if ("growthGoalFollowers" in patch) {
    next.growthGoalFollowers = normalizeNullableNumber(patch.growthGoalFollowers);
  }
  if ("growthGoalTimeline" in patch) {
    next.growthGoalTimeline = normalizeNullableString(patch.growthGoalTimeline);
  }
  if ("contentStyle" in patch) {
    next.contentStyle = normalizeNullableString(patch.contentStyle);
  }
  if ("postingFrequency" in patch) {
    next.postingFrequency = normalizeNullableNumber(patch.postingFrequency);
  }
  if ("clientObjective" in patch) {
    next.clientObjective = normalizeClientObjective(patch.clientObjective);
  }
  if ("contactEmail" in patch) {
    next.contactEmail = normalizeNullableString(patch.contactEmail);
  }

  next.updatedAt = nowIso();
  return next;
}

function normalizeCompetitorPatch(
  patch: Partial<ChannelCompetitor>,
  channelId: string,
): ChannelCompetitor {
  const existingId = normalizeString(patch.id);
  return {
    id: existingId || generateId("sf_comp"),
    channelId,
    name: normalizeString(patch.name) || "Unnamed competitor",
    handle: normalizeNullableString(patch.handle),
    platform: (normalizeString(patch.platform) as ChannelCompetitor["platform"]) || "other",
    niche: normalizeNullableString(patch.niche),
    notes: normalizeNullableString(patch.notes),
    visualStyle: normalizeNullableString(patch.visualStyle),
    postingFrequency: normalizeNullableString(patch.postingFrequency),
    engagementNotes: normalizeNullableString(patch.engagementNotes),
    strengths: normalizeStringArray(patch.strengths),
    weaknesses: normalizeStringArray(patch.weaknesses),
    differentiationOpportunities: normalizeStringArray(patch.differentiationOpportunities),
    views: typeof patch.views === "number" ? patch.views : null,
    likes: typeof patch.likes === "number" ? patch.likes : null,
    comments: typeof patch.comments === "number" ? patch.comments : null,
    shares: typeof patch.shares === "number" ? patch.shares : null,
    reelPerformance: normalizeNullableString(patch.reelPerformance),
    videoPerformance: normalizeNullableString(patch.videoPerformance),
    bestFormats: normalizeStringArray(patch.bestFormats),
    worstFormats: normalizeStringArray(patch.worstFormats),
    postingCadence: normalizeNullableString(patch.postingCadence),
    engagementQuality: normalizeNullableString(patch.engagementQuality),
    topContentThemes: normalizeStringArray(patch.topContentThemes),
    avgViews: typeof patch.avgViews === "number" ? patch.avgViews : null,
    avgLikes: typeof patch.avgLikes === "number" ? patch.avgLikes : null,
    avgComments: typeof patch.avgComments === "number" ? patch.avgComments : null,
    avgShares: typeof patch.avgShares === "number" ? patch.avgShares : null,
    engagementRate: normalizeNullableString(patch.engagementRate),
    viralitySignals: normalizeStringArray(patch.viralitySignals),
    contentHooksUsed: normalizeStringArray(patch.contentHooksUsed),
    ctaPatterns: normalizeStringArray(patch.ctaPatterns),
  };
}

function normalizeAssetPatch(
  patch: Partial<ChannelAsset>,
  channelId: string,
): ChannelAsset {
  const now = nowIso();
  return {
    id: normalizeString(patch.id) || generateId("sf_asset"),
    channelId,
    kind: (normalizeString(patch.kind) as ChannelAsset["kind"]) || "other",
    name: normalizeString(patch.name) || "Unnamed asset",
    description: normalizeNullableString(patch.description),
    url: normalizeNullableString(patch.url),
    mimeType: normalizeNullableString(patch.mimeType),
    createdAt: normalizeString(patch.createdAt) || now,
  };
}

function mapRowToSnapshot(row: ProfileRow): ChannelKnowledgeSnapshot {
  const metadataRecord = parseJsonRecord(row.metadata_json) as ProfileMetadata | null;
  const profileFromMetadata = metadataRecord?.profile ?? null;

  const base = buildEmptyProfile(row.tenant_id, row.saas_id);
  const mergedFromMetadata = profileFromMetadata ? mergeProfile(base, profileFromMetadata) : base;

  const profile: ChannelProfile = {
    ...mergedFromMetadata,
    id: normalizeString(mergedFromMetadata.id) || row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    channelId: normalizeString(mergedFromMetadata.channelId) || DEFAULT_CHANNEL_ID,
    brandName: normalizeString(row.brand_name) || mergedFromMetadata.brandName,
    channelName: normalizeString(row.display_name) || mergedFromMetadata.channelName,
    websiteUrl: normalizeString(row.website_url) || mergedFromMetadata.websiteUrl,
    shortDescription: normalizeString(row.description) || mergedFromMetadata.shortDescription,
    toneOfVoice: normalizeString(row.tone) || mergedFromMetadata.toneOfVoice,
    audienceDescription: normalizeString(row.audience) || mergedFromMetadata.audienceDescription,
    niche: normalizeString(row.business_type) || mergedFromMetadata.niche,
    ageRange: row.age_range ?? mergedFromMetadata.ageRange ?? null,
    gender: row.gender ?? mergedFromMetadata.gender ?? null,
    growthGoalFollowers: row.growth_goal_followers ?? mergedFromMetadata.growthGoalFollowers ?? null,
    growthGoalTimeline: row.growth_goal_timeline ?? mergedFromMetadata.growthGoalTimeline ?? null,
    contentStyle: row.content_style ?? mergedFromMetadata.contentStyle ?? null,
    postingFrequency: row.posting_frequency ?? mergedFromMetadata.postingFrequency ?? null,
    clientObjective: normalizeClientObjective(row.client_objective) ?? mergedFromMetadata.clientObjective ?? null,
    contactEmail: row.contact_email ?? mergedFromMetadata.contactEmail ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  const competitors = Array.isArray(metadataRecord?.competitors) ? metadataRecord.competitors : [];
  const assets = Array.isArray(metadataRecord?.assets) ? metadataRecord.assets : [];

  return { profile, competitors, assets };
}

async function findProfileRow(tenantId: string, saasId: string): Promise<ProfileRow | null> {
  const context = await resolveSocialContext({ tenantId, saasId });
  await ensureProfileTable(context.socialDb);

  const result = await context.socialDb
    .prepare(`SELECT ${PROFILE_COLUMNS} FROM ${SOCIALFLOW_PROFILE_TABLE} WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
    .bind(context.tenantId, context.saasId ?? saasId)
    .all<ProfileRow>();

  const row = result.results?.[0] ?? null;
  return row;
}

async function upsertProfileRow(snapshot: ChannelKnowledgeSnapshot): Promise<ChannelKnowledgeSnapshot> {
  const context = await resolveSocialContext({ tenantId: snapshot.profile.tenantId, saasId: snapshot.profile.saasId });
  await ensureProfileTable(context.socialDb);

  const existing = await findProfileRow(snapshot.profile.tenantId, snapshot.profile.saasId);
  const rowId = existing?.id ?? snapshot.profile.id ?? generateId("sf_profile");
  const createdAt = existing?.created_at ?? snapshot.profile.createdAt ?? nowIso();
  const updatedAt = nowIso();

  const metadata: ProfileMetadata = {
    profile: snapshot.profile,
    competitors: snapshot.competitors,
    assets: snapshot.assets,
  };

  await context.socialDb.prepare(
    `INSERT INTO ${SOCIALFLOW_PROFILE_TABLE} (
      id, tenant_id, saas_id, display_name, brand_name, business_type, website_url, description, tone, audience, goals_json, metadata_json,
      age_range, gender, growth_goal_followers, growth_goal_timeline, content_style, posting_frequency, client_objective, contact_email, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
      id = excluded.id,
      display_name = excluded.display_name,
      brand_name = excluded.brand_name,
      business_type = excluded.business_type,
      website_url = excluded.website_url,
      description = excluded.description,
      tone = excluded.tone,
      audience = excluded.audience,
      goals_json = excluded.goals_json,
      metadata_json = excluded.metadata_json,
      age_range = excluded.age_range,
      gender = excluded.gender,
      growth_goal_followers = excluded.growth_goal_followers,
      growth_goal_timeline = excluded.growth_goal_timeline,
      content_style = excluded.content_style,
      posting_frequency = excluded.posting_frequency,
      client_objective = excluded.client_objective,
      contact_email = excluded.contact_email,
      updated_at = excluded.updated_at`,
  ).bind(
    rowId,
    snapshot.profile.tenantId,
    snapshot.profile.saasId,
    normalizeNullableString(snapshot.profile.channelName),
    normalizeNullableString(snapshot.profile.brandName),
    normalizeNullableString(snapshot.profile.niche),
    normalizeNullableString(snapshot.profile.websiteUrl),
    normalizeNullableString(snapshot.profile.shortDescription),
    normalizeNullableString(snapshot.profile.toneOfVoice),
    normalizeNullableString(snapshot.profile.audienceDescription),
    serializeJsonRecord(snapshot.profile.transformations),
    serializeJsonRecord(metadata),
    normalizeNullableString(snapshot.profile.ageRange),
    normalizeNullableString(snapshot.profile.gender),
    normalizeNullableNumber(snapshot.profile.growthGoalFollowers),
    normalizeNullableString(snapshot.profile.growthGoalTimeline),
    normalizeNullableString(snapshot.profile.contentStyle),
    normalizeNullableNumber(snapshot.profile.postingFrequency),
    normalizeClientObjective(snapshot.profile.clientObjective),
    normalizeNullableString(snapshot.profile.contactEmail),
    createdAt,
    updatedAt,
  ).run();

  const stored = await findProfileRow(snapshot.profile.tenantId, snapshot.profile.saasId);
  if (!stored) {
    throw new SocialContextError("Unable to persist SocialFlow profile row.");
  }
  return mapRowToSnapshot(stored);
}

export async function getChannelKnowledge(
  tenantId: string,
  saasId = DEFAULT_SAAS_ID,
): Promise<ChannelKnowledgeSnapshot> {
  const row = await findProfileRow(tenantId, saasId);
  if (!row) {
    return {
      profile: buildEmptyProfile(tenantId, saasId),
      competitors: [],
      assets: [],
    };
  }
  return mapRowToSnapshot(row);
}

export async function getChannelProfile(tenantId: string, saasId = DEFAULT_SAAS_ID): Promise<ChannelProfile> {
  return (await getChannelKnowledge(tenantId, saasId)).profile;
}

export async function upsertChannelProfile(
  tenantId: string,
  patch: Partial<ChannelProfile>,
  saasId = DEFAULT_SAAS_ID,
): Promise<ChannelProfile> {
  const current = await getChannelKnowledge(tenantId, saasId);
  const merged = mergeProfile(current.profile, patch);
  const stored = await upsertProfileRow({
    profile: {
      ...merged,
      id: current.profile.id,
      tenantId,
      saasId,
      channelId: current.profile.channelId || DEFAULT_CHANNEL_ID,
      createdAt: current.profile.createdAt,
      updatedAt: merged.updatedAt,
    },
    competitors: current.competitors,
    assets: current.assets,
  });
  return stored.profile;
}

export async function listChannelCompetitors(tenantId: string, saasId = DEFAULT_SAAS_ID): Promise<ChannelCompetitor[]> {
  return (await getChannelKnowledge(tenantId, saasId)).competitors;
}

export async function upsertChannelCompetitor(
  tenantId: string,
  competitorPatch: Partial<ChannelCompetitor>,
  saasId = DEFAULT_SAAS_ID,
): Promise<ChannelCompetitor> {
  const current = await getChannelKnowledge(tenantId, saasId);
  const normalized = normalizeCompetitorPatch(competitorPatch, current.profile.channelId || DEFAULT_CHANNEL_ID);
  const index = current.competitors.findIndex((item) => item.id === normalized.id);
  const nextCompetitors = [...current.competitors];
  if (index >= 0) {
    nextCompetitors[index] = { ...nextCompetitors[index], ...normalized };
  } else {
    nextCompetitors.push(normalized);
  }

  const stored = await upsertProfileRow({
    profile: current.profile,
    competitors: nextCompetitors,
    assets: current.assets,
  });
  return stored.competitors.find((item) => item.id === normalized.id) ?? normalized;
}

export async function listChannelAssets(tenantId: string, saasId = DEFAULT_SAAS_ID): Promise<ChannelAsset[]> {
  return (await getChannelKnowledge(tenantId, saasId)).assets;
}

export async function saveChannelAssetMetadata(
  tenantId: string,
  assetPatch: Partial<ChannelAsset>,
  saasId = DEFAULT_SAAS_ID,
): Promise<ChannelAsset> {
  const current = await getChannelKnowledge(tenantId, saasId);
  const normalized = normalizeAssetPatch(assetPatch, current.profile.channelId || DEFAULT_CHANNEL_ID);
  const index = current.assets.findIndex((item) => item.id === normalized.id);
  const nextAssets = [...current.assets];
  if (index >= 0) {
    nextAssets[index] = { ...nextAssets[index], ...normalized };
  } else {
    nextAssets.push(normalized);
  }

  const stored = await upsertProfileRow({
    profile: current.profile,
    competitors: current.competitors,
    assets: nextAssets,
  });
  return stored.assets.find((item) => item.id === normalized.id) ?? normalized;
}

export async function saveCompetitorInsights(
  tenantId: string,
  insights: CompetitorInsights[],
  saasId = DEFAULT_SAAS_ID,
): Promise<ChannelCompetitor[]> {
  let snapshot = await getChannelKnowledge(tenantId, saasId);

  for (const insight of insights) {
    const id = `intel_${normalizeString(insight.name).toLowerCase().replace(/[^a-z0-9]+/g, "-") || generateId("comp")}`;
    const patch: Partial<ChannelCompetitor> = {
      id,
      name: insight.name,
      platform: insight.platform as ChannelCompetitor["platform"],
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
    };

    const normalized = normalizeCompetitorPatch(patch, snapshot.profile.channelId || DEFAULT_CHANNEL_ID);
    const idx = snapshot.competitors.findIndex((item) => item.id === normalized.id);
    if (idx >= 0) snapshot.competitors[idx] = { ...snapshot.competitors[idx], ...normalized };
    else snapshot.competitors.push(normalized);
  }

  snapshot = await upsertProfileRow(snapshot);
  return snapshot.competitors;
}
