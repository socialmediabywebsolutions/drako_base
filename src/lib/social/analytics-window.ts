import type { AnalyticsMeta, SaasSocialPost } from "@/lib/social/types";

export function getPostAnalyticsMetadata(post: SaasSocialPost): AnalyticsMeta {
  const meta = (post as unknown as { analyticsMeta?: Partial<AnalyticsMeta> }).analyticsMeta;
  return {
    source: meta?.source ?? "placeholder",
    impressions: meta?.impressions ?? 0,
    likes: meta?.likes ?? 0,
    comments: meta?.comments ?? 0,
    shares: meta?.shares ?? 0,
    clicks: meta?.clicks ?? 0,
    engagement: meta?.engagement ?? 0,
    lastFetchedAt: meta?.lastFetchedAt ?? null,
    lastRefreshStatus: meta?.lastRefreshStatus ?? null,
    lastRefreshErrorMessage: meta?.lastRefreshErrorMessage ?? null,
    lastRefreshErrorCode: meta?.lastRefreshErrorCode ?? null,
  };
}

export function hasLivePostAnalytics(post: SaasSocialPost): boolean {
  const analytics = getPostAnalyticsMetadata(post);
  return analytics.source !== "placeholder" && analytics.impressions + analytics.engagement + analytics.likes > 0;
}
