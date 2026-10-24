import type {
  SaasSocialMetrics,
  SaasSocialPost,
  SaasSocialProvider,
  SocialLiveAnalyticsSummary,
  SocialLiveAnalyticsSyncActivity,
  SocialPostAnalyticsMetadata,
  SocialAnalyticsWindow,
} from "@/lib/social/types";

export const RESOLVED_RECENTLY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const HEALTHY_LIVE_SYNC_FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

function isPublishedStatus(status: string | null | undefined): boolean {
  return status === "PUBLISHED" || status === "POSTED";
}

export function getPostAnalyticsMetadata(post: SaasSocialPost): SocialPostAnalyticsMetadata | null {
  if (!post.metadata?.analytics || typeof post.metadata.analytics !== "object") return null;
  const analytics = post.metadata.analytics as Record<string, unknown>;
  if (
    typeof analytics.impressions !== "number"
    || typeof analytics.likes !== "number"
    || typeof analytics.comments !== "number"
    || typeof analytics.shares !== "number"
    || typeof analytics.lastFetchedAt !== "string"
  ) {
    return null;
  }
  return {
    impressions: analytics.impressions,
    likes: analytics.likes,
    comments: analytics.comments,
    shares: analytics.shares,
    lastFetchedAt: analytics.lastFetchedAt,
    source: analytics.source === "live_linkedin" || analytics.source === "placeholder_mvp" || analytics.source === "analytics_fallback"
      ? analytics.source
      : "analytics_fallback",
    lastRefreshStatus: analytics.lastRefreshStatus === "success" || analytics.lastRefreshStatus === "error"
      ? analytics.lastRefreshStatus
      : undefined,
    lastRefreshErrorCode: typeof analytics.lastRefreshErrorCode === "string" ? analytics.lastRefreshErrorCode : null,
    lastRefreshErrorMessage: typeof analytics.lastRefreshErrorMessage === "string" ? analytics.lastRefreshErrorMessage : null,
    manualReviewStatus: analytics.manualReviewStatus === "reviewed" ? "reviewed" : undefined,
    manualReviewAt: typeof analytics.manualReviewAt === "string" ? analytics.manualReviewAt : null,
    manualReviewNote: typeof analytics.manualReviewNote === "string" ? analytics.manualReviewNote : null,
    recoveryStatus: analytics.recoveryStatus === "resolved_by_live_refresh" ? "resolved_by_live_refresh" : undefined,
    recoveryAt: typeof analytics.recoveryAt === "string" ? analytics.recoveryAt : null,
  };
}

export function hasLivePostAnalytics(post: SaasSocialPost): boolean {
  return getPostAnalyticsMetadata(post)?.source === "live_linkedin";
}

export function isEligibleLinkedInLiveAnalyticsPost(post: SaasSocialPost): boolean {
  if ((post.status !== "PUBLISHED" && post.status !== "POSTED") || post.provider !== "LINKEDIN" || !post.externalPostId) {
    return false;
  }
  if (!post.metadata?.publication || typeof post.metadata.publication !== "object") return false;
  return (post.metadata.publication as Record<string, unknown>).mode === "live";
}

function compareRecentFirst(left: { lastFetchedAt: string }, right: { lastFetchedAt: string }): number {
  return new Date(right.lastFetchedAt).getTime() - new Date(left.lastFetchedAt).getTime();
}

function isResolvedRecently(analytics: SocialPostAnalyticsMetadata, nowMs: number): boolean {
  if (
    analytics.recoveryStatus !== "resolved_by_live_refresh"
    || analytics.source !== "live_linkedin"
    || analytics.lastRefreshStatus === "error"
    || !analytics.recoveryAt
  ) {
    return false;
  }
  const recoveryAtMs = new Date(analytics.recoveryAt).getTime();
  if (Number.isNaN(recoveryAtMs)) return false;
  const ageMs = nowMs - recoveryAtMs;
  return ageMs >= 0 && ageMs <= RESOLVED_RECENTLY_WINDOW_MS;
}

function getHealthySyncFreshness(lastHealthyLiveSyncAt: string | null, nowMs: number) {
  if (!lastHealthyLiveSyncAt) {
    return {
      healthySyncFreshnessStatus: "NOT_AVAILABLE" as const,
      healthySyncNeedsRefresh: false,
    };
  }
  const lastHealthyMs = new Date(lastHealthyLiveSyncAt).getTime();
  if (Number.isNaN(lastHealthyMs)) {
    return {
      healthySyncFreshnessStatus: "NOT_AVAILABLE" as const,
      healthySyncNeedsRefresh: false,
    };
  }
  const ageMs = nowMs - lastHealthyMs;
  if (ageMs < 0 || ageMs <= HEALTHY_LIVE_SYNC_FRESH_WINDOW_MS) {
    return {
      healthySyncFreshnessStatus: "FRESH" as const,
      healthySyncNeedsRefresh: false,
    };
  }
  return {
    healthySyncFreshnessStatus: "AGING" as const,
    healthySyncNeedsRefresh: true,
  };
}

function buildSyncActivity(post: SaasSocialPost, analytics: SocialPostAnalyticsMetadata, nowMs: number): SocialLiveAnalyticsSyncActivity {
  const resolvedRecently = isResolvedRecently(analytics, nowMs);
  const state =
    resolvedRecently
      ? "resolved"
      : analytics.lastRefreshStatus === "error"
      ? "error"
      : analytics.source === "analytics_fallback"
        ? "fallback"
        : "success";

  const summary =
    state === "error"
      ? "Post refresh failed"
      : state === "fallback"
        ? "Fallback analytics active"
        : state === "resolved"
          ? "Resolved by live refresh"
        : "Post synced successfully";

  const recommendation =
    state === "resolved"
      ? "Incident resolved by successful live refresh."
      : analytics.manualReviewStatus === "reviewed"
      ? state === "error"
        ? "Reviewed manually. Reconnect LinkedIn before retrying again."
        : state === "fallback"
          ? "Reviewed manually. Retry live analytics when you want this post to leave fallback mode."
          : "No action needed."
      : state === "error"
        ? analytics.lastRefreshErrorCode?.includes("REAUTH") || analytics.lastRefreshErrorCode?.includes("INVALID")
          ? "Reconnect LinkedIn and rerun workspace refresh."
          : "Retry the post analytics refresh after reviewing the last sync error."
        : state === "fallback"
          ? "Run a live analytics refresh again so this post can leave fallback mode."
          : "No action needed.";

  return {
    postId: post.id,
    postTitle: post.title,
    provider: post.provider,
    lastFetchedAt: analytics.lastFetchedAt,
    lastRefreshStatus: analytics.lastRefreshStatus === "error" ? "error" : "success",
    lastRefreshErrorCode: analytics.lastRefreshErrorCode ?? null,
    lastRefreshErrorMessage: analytics.lastRefreshErrorMessage ?? null,
    analyticsSource: analytics.source,
    externalPostId: post.externalPostId,
    state,
    summary,
    recommendation,
    reviewed: analytics.manualReviewStatus === "reviewed",
    manualReviewAt: analytics.manualReviewAt ?? null,
    manualReviewNote: analytics.manualReviewNote ?? null,
    recoveryAt: analytics.recoveryAt ?? null,
  };
}

export function summarizeLinkedInLiveAnalyticsHealth(posts: SaasSocialPost[], now: Date = new Date()): SocialLiveAnalyticsSummary {
  const nowMs = now.getTime();
  const eligiblePosts = posts.filter(isEligibleLinkedInLiveAnalyticsPost);
  const healthyLiveEntries = eligiblePosts
    .map((post) => getPostAnalyticsMetadata(post))
    .filter((analytics): analytics is SocialPostAnalyticsMetadata =>
      Boolean(analytics && analytics.source === "live_linkedin" && analytics.lastRefreshStatus !== "error"),
    );
  const lastHealthyLiveSyncAt = healthyLiveEntries
    .map((analytics) => analytics.lastFetchedAt)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
  const { healthySyncFreshnessStatus, healthySyncNeedsRefresh } = getHealthySyncFreshness(lastHealthyLiveSyncAt, nowMs);
  const resolvedRecentlyEntries = eligiblePosts
    .map((post) => getPostAnalyticsMetadata(post))
    .filter((analytics): analytics is SocialPostAnalyticsMetadata =>
      Boolean(analytics && isResolvedRecently(analytics, nowMs)),
    );
  const resolvedRecentlyCount = resolvedRecentlyEntries.length;
  const lastResolvedAt = resolvedRecentlyEntries
    .map((analytics) => analytics.recoveryAt ?? analytics.lastFetchedAt)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
  const recentActivity = eligiblePosts
    .map((post) => {
      const analytics = getPostAnalyticsMetadata(post);
      return analytics ? buildSyncActivity(post, analytics, nowMs) : null;
    })
    .filter((item): item is SocialLiveAnalyticsSyncActivity => Boolean(item))
    .sort(compareRecentFirst)
    .slice(0, 5);
  const recentIncidents = recentActivity.filter((item) => item.state === "fallback" || item.state === "error").slice(0, 5);
  const healthyPosts = eligiblePosts.filter((post) => {
    const analytics = getPostAnalyticsMetadata(post);
    return analytics?.source === "live_linkedin" && analytics.lastRefreshStatus !== "error";
  }).length;
  const failedPosts = eligiblePosts.filter((post) => {
    const analytics = getPostAnalyticsMetadata(post);
    return analytics?.lastRefreshStatus === "error" || analytics?.source === "analytics_fallback";
  }).length;
  const noLiveAnalyticsYetPosts = Math.max(0, eligiblePosts.length - healthyPosts - failedPosts);

  const lastWorkspaceSyncAt = eligiblePosts
    .map((post) => getPostAnalyticsMetadata(post)?.lastFetchedAt ?? null)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

  if (eligiblePosts.length === 0) {
    return {
      totalEligibleLivePosts: 0,
      healthyPosts: 0,
      failedPosts: 0,
      noLiveAnalyticsYetPosts: 0,
      lastHealthyLiveSyncAt: null,
      healthySyncFreshnessStatus,
      healthySyncNeedsRefresh,
      resolvedRecently: false,
      resolvedRecentlyCount: 0,
      lastResolvedAt: null,
      lastWorkspaceSyncAt: null,
      status: "No live analytics yet",
      recommendation: "Publish one live LinkedIn post before expecting real analytics.",
      recentActivity: [],
      recentIncidents: [],
    };
  }

  if (failedPosts > 0) {
    const hasReconnectIssue = recentIncidents.some((item) =>
      item.lastRefreshErrorCode?.includes("REAUTH") || item.lastRefreshErrorCode?.includes("INVALID"),
    );
    const hasFallbackOnly = recentIncidents.some((item) => item.state === "fallback");
    return {
      totalEligibleLivePosts: eligiblePosts.length,
      healthyPosts,
      failedPosts,
      noLiveAnalyticsYetPosts,
      lastHealthyLiveSyncAt,
      healthySyncFreshnessStatus,
      healthySyncNeedsRefresh,
      resolvedRecently: resolvedRecentlyCount > 0,
      resolvedRecentlyCount,
      lastResolvedAt,
      lastWorkspaceSyncAt,
      status: "Needs attention",
      recommendation: hasReconnectIssue
        ? "Reconnect LinkedIn and rerun workspace refresh."
        : hasFallbackOnly
          ? "One live post still uses fallback analytics."
          : "Recent refreshes succeeded, but one post still needs manual review.",
      recentActivity,
      recentIncidents,
    };
  }

  if (healthyPosts === 0) {
    return {
      totalEligibleLivePosts: eligiblePosts.length,
      healthyPosts,
      failedPosts,
      noLiveAnalyticsYetPosts,
      lastHealthyLiveSyncAt,
      healthySyncFreshnessStatus,
      healthySyncNeedsRefresh,
      resolvedRecently: resolvedRecentlyCount > 0,
      resolvedRecentlyCount,
      lastResolvedAt,
      lastWorkspaceSyncAt,
      status: "No live analytics yet",
      recommendation: "Refresh LinkedIn live analytics after the first live publish completes.",
      recentActivity,
      recentIncidents,
    };
  }

  return {
    totalEligibleLivePosts: eligiblePosts.length,
    healthyPosts,
    failedPosts,
    noLiveAnalyticsYetPosts,
    lastHealthyLiveSyncAt,
    healthySyncFreshnessStatus,
    healthySyncNeedsRefresh,
    resolvedRecently: resolvedRecentlyCount > 0,
    resolvedRecentlyCount,
    lastResolvedAt,
    lastWorkspaceSyncAt,
    status: "Healthy",
    recommendation: "Live analytics are healthy; no recent incidents detected.",
    recentActivity,
    recentIncidents,
  };
}

export function buildMetricsFromPostAnalytics(post: SaasSocialPost): SaasSocialMetrics | null {
  const analytics = getPostAnalyticsMetadata(post);
  if (!analytics) return null;

  const clicks = Math.max(0, Math.round((analytics.likes + analytics.comments + analytics.shares) * 0.12));
  return {
    id: `post-analytics:${post.id}`,
    tenantId: post.tenantId,
    saasId: post.saasId,
    postId: post.id,
    provider: post.provider,
    impressions: analytics.impressions,
    likes: analytics.likes,
    comments: analytics.comments,
    shares: analytics.shares,
    clicks,
    leadsGenerated: Math.max(0, Math.round(clicks * 0.08)),
    capturedAt: analytics.lastFetchedAt,
    metadata: {
      source: analytics.source ?? "post_metadata",
    },
  };
}

export function resolveAnalyticsMetric(post: SaasSocialPost, fallbackMetric: SaasSocialMetrics | null): SaasSocialMetrics | null {
  return buildMetricsFromPostAnalytics(post) ?? fallbackMetric;
}

export function summarizeSocialMetricsWindow(metrics: SaasSocialMetrics[], publishedPosts: SaasSocialPost[]): SocialAnalyticsWindow {
  const providerTotals = new Map<SaasSocialProvider, number>();
  for (const metric of metrics) {
    providerTotals.set(metric.provider, (providerTotals.get(metric.provider) ?? 0) + metric.impressions);
  }

  let topProvider: SaasSocialProvider | null = null;
  let topProviderScore = Number.NEGATIVE_INFINITY;
  for (const [provider, score] of providerTotals.entries()) {
    if (score > topProviderScore) {
      topProvider = provider;
      topProviderScore = score;
    }
  }

  const engagement = metrics.reduce((acc, metric) => acc + metric.likes + metric.comments + metric.shares + metric.clicks, 0);
  const publishedPostsCount = publishedPosts.filter((post) => isPublishedStatus(post.status)).length;

  return {
    impressions: metrics.reduce((acc, metric) => acc + metric.impressions, 0),
    likes: metrics.reduce((acc, metric) => acc + metric.likes, 0),
    comments: metrics.reduce((acc, metric) => acc + metric.comments, 0),
    shares: metrics.reduce((acc, metric) => acc + metric.shares, 0),
    clicks: metrics.reduce((acc, metric) => acc + metric.clicks, 0),
    engagement,
    publishedPosts: publishedPostsCount,
    topProvider,
    averageEngagementPerPublishedPost: publishedPostsCount > 0 ? Number((engagement / publishedPostsCount).toFixed(2)) : 0,
  };
}
