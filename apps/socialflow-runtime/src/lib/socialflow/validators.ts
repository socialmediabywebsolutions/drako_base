import type {
  RuntimeCampaignUpsertInput,
  RuntimeChannelCompetitor,
  RuntimeChannelProfile,
  RuntimePostUpsertInput,
  RuntimeSocialCampaignStatus,
  RuntimeSocialContentType,
  RuntimeSocialPostStatus,
  RuntimeSocialProvider,
} from "./contracts";

const PROFILE_STRING_FIELDS = [
  "brandName",
  "channelName",
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
] as const;

const PROFILE_NULLABLE_STRING_FIELDS = [
  "assetSummary",
] as const;

const PROFILE_ARRAY_FIELDS = [
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
] as const;

const COMPETITOR_STRING_FIELDS = [
  "name",
  "niche",
  "notes",
  "visualStyle",
  "postingFrequency",
  "engagementNotes",
  "reelPerformance",
  "videoPerformance",
  "postingCadence",
  "engagementQuality",
  "engagementRate",
] as const;

const COMPETITOR_NULLABLE_STRING_FIELDS = ["handle"] as const;

const COMPETITOR_ARRAY_FIELDS = [
  "strengths",
  "weaknesses",
  "differentiationOpportunities",
  "bestFormats",
  "worstFormats",
  "topContentThemes",
  "viralitySignals",
  "contentHooksUsed",
  "ctaPatterns",
] as const;

const COMPETITOR_NUMBER_FIELDS = [
  "views",
  "likes",
  "comments",
  "shares",
  "avgViews",
  "avgLikes",
  "avgComments",
  "avgShares",
] as const;

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeNullableString(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const next = value.trim();
  return next.length > 0 ? next : null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((entry) => normalizeString(entry)).filter(Boolean)));
}

function normalizeNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function normalizeRuntimeCampaignInput(input: RuntimeCampaignUpsertInput): RuntimeCampaignUpsertInput {
  return {
    id: normalizeNullableString(input.id) ?? undefined,
    saasId: normalizeString(input.saasId),
    name: normalizeString(input.name),
    objective: normalizeString(input.objective, "AWARENESS"),
    status: input.status,
    targetSegment: normalizeString(input.targetSegment, "DEFAULT"),
    startDate: normalizeNullableString(input.startDate),
    endDate: normalizeNullableString(input.endDate),
    budgetEstimate: normalizeNullableNumber(input.budgetEstimate),
    notes: normalizeNullableString(input.notes),
  };
}

export function normalizeRuntimePostInput(input: RuntimePostUpsertInput): RuntimePostUpsertInput {
  return {
    id: normalizeNullableString(input.id) ?? undefined,
    saasId: normalizeString(input.saasId),
    campaignId: normalizeNullableString(input.campaignId),
    channelId: normalizeNullableString(input.channelId),
    provider: input.provider,
    contentType: input.contentType,
    title: normalizeString(input.title),
    body: normalizeString(input.body),
    imageHint: normalizeNullableString(input.imageHint),
    status: input.status,
    scheduledAt: normalizeNullableString(input.scheduledAt),
    postedAt: normalizeNullableString(input.postedAt),
    externalPostId: normalizeNullableString(input.externalPostId),
    metadata: asRecord(input.metadata),
  };
}

export function normalizeRuntimeProfilePatch(input: unknown): Partial<RuntimeChannelProfile> | null {
  const record = asRecord(input);
  if (!record) return null;

  const patch: Partial<RuntimeChannelProfile> = {};

  for (const field of PROFILE_STRING_FIELDS) {
    if (field in record && typeof record[field] === "string") {
      patch[field] = normalizeString(record[field]) as RuntimeChannelProfile[typeof field];
    }
  }

  for (const field of PROFILE_NULLABLE_STRING_FIELDS) {
    if (field in record) {
      patch[field] = normalizeNullableString(record[field]) as RuntimeChannelProfile[typeof field];
    }
  }

  for (const field of PROFILE_ARRAY_FIELDS) {
    if (field in record) {
      patch[field] = normalizeStringArray(record[field]) as RuntimeChannelProfile[typeof field];
    }
  }

  if ("avgPrice" in record) {
    patch.avgPrice = normalizeNullableNumber(record.avgPrice);
  }

  return patch;
}

export function normalizeRuntimeCompetitorPatch(input: unknown): Partial<RuntimeChannelCompetitor> | null {
  const record = asRecord(input);
  if (!record) return null;

  const patch: Partial<RuntimeChannelCompetitor> = {};

  if ("id" in record) {
    patch.id = normalizeNullableString(record.id) ?? undefined;
  }

  if ("platform" in record && typeof record.platform === "string") {
    const platform = normalizeString(record.platform).toLowerCase();
    if (["instagram", "tiktok", "linkedin", "facebook", "youtube", "x", "other"].includes(platform)) {
      patch.platform = platform as RuntimeChannelCompetitor["platform"];
    }
  }

  for (const field of COMPETITOR_STRING_FIELDS) {
    if (field in record && typeof record[field] === "string") {
      (patch as Record<string, unknown>)[field] = normalizeString(record[field]);
    }
  }

  for (const field of COMPETITOR_NULLABLE_STRING_FIELDS) {
    if (field in record) {
      (patch as Record<string, unknown>)[field] = normalizeNullableString(record[field]);
    }
  }

  for (const field of COMPETITOR_ARRAY_FIELDS) {
    if (field in record) {
      (patch as Record<string, unknown>)[field] = normalizeStringArray(record[field]);
    }
  }

  for (const field of COMPETITOR_NUMBER_FIELDS) {
    if (field in record) {
      (patch as Record<string, unknown>)[field] = normalizeNullableNumber(record[field]);
    }
  }

  return patch;
}

export function isRuntimeCampaignStatus(value: string): value is RuntimeSocialCampaignStatus {
  return ["DRAFT", "ACTIVE", "PAUSED", "FINISHED", "ARCHIVED"].includes(value);
}

export function isRuntimePostStatus(value: string): value is RuntimeSocialPostStatus {
  return ["IDEA", "DRAFT", "IN_REVIEW", "APPROVED", "REJECTED", "SCHEDULED", "PUBLISHING", "POSTED", "PUBLISHED", "FAILED"].includes(value);
}

export function isRuntimeContentType(value: string): value is RuntimeSocialContentType {
  return ["FEED", "STORY", "REEL", "SHORT", "CAROUSEL"].includes(value);
}

export function isRuntimeProvider(value: string): value is RuntimeSocialProvider {
  return value === "LINKEDIN";
}
