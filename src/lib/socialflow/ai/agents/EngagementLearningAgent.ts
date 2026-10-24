import type { SaasSocialPost } from "@/lib/social-core/types";
import { classifyHook, extractHashtags } from "./contentHeuristics";

export type PostWithEngagement = {
  post: SaasSocialPost;
  engagement: number;
  hasMetrics: boolean;
};

export type CaptionLengthBucket = "corto" | "medio" | "largo";

export type HookEngagementStat = { hook: string; avgEngagement: number; uses: number };
export type FormatEngagementStat = { format: string; avgEngagement: number; uses: number };
export type CaptionLengthStat = { bucket: CaptionLengthBucket; avgEngagement: number; uses: number };
export type HourEngagementStat = { hourUtc: number; avgEngagement: number; uses: number };
export type HashtagEngagementStat = { hashtag: string; avgEngagement: number; postsCount: number };

export type EngagementPatterns = {
  hookPerformance: HookEngagementStat[];
  formatPerformance: FormatEngagementStat[];
  captionLengthCorrelation: CaptionLengthStat[];
  hourPerformance: HourEngagementStat[];
  hashtagsQueFuncionan: HashtagEngagementStat[];
};

const CAPTION_SHORT_MAX = 150;
const CAPTION_MEDIUM_MAX = 400;
// Hashtags are unbounded cardinality — unlike hook/format/hour (a handful of fixed
// buckets each), a tenant can use dozens of distinct hashtags. Capped here (per tenant)
// and again after the cross-tenant merge in CrossTenantIntelligenceAgent, same ceiling
// StyleLearningAgent.topHashtags already uses (there: 10; here: 20, since this feeds a
// cross-tenant aggregate that needs more raw candidates before its own 2-tenant filter).
const MAX_HASHTAGS = 20;

function captionLengthBucket(length: number): CaptionLengthBucket {
  if (length < CAPTION_SHORT_MAX) return "corto";
  if (length < CAPTION_MEDIUM_MAX) return "medio";
  return "largo";
}

// Groups posts by `keyFor` and averages engagement per group. Only posts with real
// captured metrics (hasMetrics) count — a post nobody has synced Instagram Insights
// for yet is "unknown", not "0 engagement", so mixing it in would silently drag every
// average toward zero for tenants/niches with a slow-running metrics cron.
function buildStats<K extends string>(
  entries: PostWithEngagement[],
  keyFor: (entry: PostWithEngagement) => K | null,
): Array<{ key: K; avgEngagement: number; uses: number }> {
  const stats = new Map<K, { totalEngagement: number; uses: number }>();
  for (const entry of entries) {
    if (!entry.hasMetrics) continue;
    const key = keyFor(entry);
    if (key === null) continue;
    const bucket = stats.get(key) ?? { totalEngagement: 0, uses: 0 };
    bucket.totalEngagement += entry.engagement;
    bucket.uses += 1;
    stats.set(key, bucket);
  }
  return Array.from(stats.entries())
    .map(([key, { totalEngagement, uses }]) => ({
      key,
      avgEngagement: Math.round((totalEngagement / uses) * 10) / 10,
      uses,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);
}

function hourKeyFor(entry: PostWithEngagement): string | null {
  const stamp = entry.post.postedAt ?? entry.post.scheduledAt;
  if (!stamp) return null;
  return String(new Date(stamp).getUTCHours());
}

// Separate from buildStats() because a hashtag isn't one key per post — each post can
// carry several, so a post's engagement is counted once per hashtag it has (same
// multi-count approach StyleLearningAgent.topHashtags already uses).
function buildHashtagStats(entries: PostWithEngagement[]): HashtagEngagementStat[] {
  const stats = new Map<string, { totalEngagement: number; postsCount: number }>();
  for (const entry of entries) {
    if (!entry.hasMetrics) continue;
    for (const hashtag of extractHashtags(entry.post)) {
      const bucket = stats.get(hashtag) ?? { totalEngagement: 0, postsCount: 0 };
      bucket.totalEngagement += entry.engagement;
      bucket.postsCount += 1;
      stats.set(hashtag, bucket);
    }
  }
  return Array.from(stats.entries())
    .map(([hashtag, { totalEngagement, postsCount }]) => ({
      hashtag,
      avgEngagement: Math.round((totalEngagement / postsCount) * 10) / 10,
      postsCount,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, MAX_HASHTAGS);
}

// Deterministic, LLM-free analysis of what actually correlates with engagement for a
// set of posts — reused per-tenant (folded into StyleLearningAgent's snapshot, see
// EngagementLearningAgent.analyze below) and cross-tenant (CrossTenantIntelligenceAgent
// calls this once per member tenant before aggregating anonymously by niche).
export function computeEngagementPatterns(withEngagement: PostWithEngagement[]): EngagementPatterns {
  const hookStats = buildStats(withEngagement, (e) => classifyHook(e.post.body.split("\n")[0] ?? ""));
  const formatStats = buildStats(withEngagement, (e) => e.post.contentType);
  const lengthStats = buildStats(withEngagement, (e) => captionLengthBucket(e.post.body.length));
  const hourStats = buildStats(withEngagement, hourKeyFor);
  const hashtagStats = buildHashtagStats(withEngagement);

  return {
    hookPerformance: hookStats.map(({ key, avgEngagement, uses }) => ({ hook: key, avgEngagement, uses })),
    formatPerformance: formatStats.map(({ key, avgEngagement, uses }) => ({ format: key, avgEngagement, uses })),
    captionLengthCorrelation: lengthStats.map(({ key, avgEngagement, uses }) => ({
      bucket: key,
      avgEngagement,
      uses,
    })),
    hourPerformance: hourStats.map(({ key, avgEngagement, uses }) => ({ hourUtc: Number(key), avgEngagement, uses })),
    hashtagsQueFuncionan: hashtagStats,
  };
}

export class EngagementLearningAgent {
  analyze(withEngagement: PostWithEngagement[]): EngagementPatterns {
    return computeEngagementPatterns(withEngagement);
  }
}
