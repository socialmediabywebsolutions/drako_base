import { describe, expect, it } from "vitest";
import {
  buildMetricsFromPostAnalytics,
  resolveAnalyticsMetric,
  summarizeLinkedInLiveAnalyticsHealth,
  summarizeSocialMetricsWindow,
} from "@/lib/social/analytics-window";
import type { SaasSocialMetrics, SaasSocialPost } from "@/lib/social/types";

function buildPost(overrides: Partial<SaasSocialPost> = {}): SaasSocialPost {
  return {
    id: "post_1",
    tenantId: "tenant_1",
    saasId: "saas_1",
    campaignId: null,
    channelId: null,
    provider: "LINKEDIN",
    contentType: "FEED",
    title: "Launch update",
    body: "Hello LinkedIn",
    imageHint: null,
    status: "PUBLISHED",
    scheduledAt: "2026-03-13T10:00:00.000Z",
    postedAt: "2026-03-13T10:00:00.000Z",
    externalPostId: "urn:li:ugcPost:123",
    metadata: null,
    createdAt: "2026-03-13T10:00:00.000Z",
    updatedAt: "2026-03-13T10:00:00.000Z",
    ...overrides,
  };
}

function buildMetric(overrides: Partial<SaasSocialMetrics> = {}): SaasSocialMetrics {
  return {
    id: "metric_1",
    tenantId: "tenant_1",
    saasId: "saas_1",
    postId: "post_1",
    provider: "INSTAGRAM",
    impressions: 400,
    likes: 16,
    comments: 3,
    shares: 2,
    clicks: 10,
    leadsGenerated: 1,
    capturedAt: "2026-03-13T10:05:00.000Z",
    metadata: { source: "placeholder_mvp" },
    ...overrides,
  };
}

describe("social analytics window", () => {
  it("falls back to placeholder metrics when live analytics are missing", () => {
    const post = buildPost({
      provider: "INSTAGRAM",
      metadata: null,
    });
    const fallbackMetric = buildMetric();

    const resolved = resolveAnalyticsMetric(post, fallbackMetric);

    expect(buildMetricsFromPostAnalytics(post)).toBeNull();
    expect(resolved).toEqual(fallbackMetric);
  });

  it("aggregates workspace analytics from live and placeholder metrics together", () => {
    const livePost = buildPost({
      metadata: {
        analytics: {
          impressions: 820,
          likes: 31,
          comments: 7,
          shares: 5,
          lastFetchedAt: "2026-03-13T10:10:00.000Z",
          source: "live_linkedin",
        },
      },
    });
    const demoPost = buildPost({
      id: "post_2",
      provider: "INSTAGRAM",
      externalPostId: null,
      metadata: null,
    });
    const liveMetric = buildMetricsFromPostAnalytics(livePost);
    const demoMetric = buildMetric({
      id: "metric_2",
      postId: "post_2",
      provider: "INSTAGRAM",
      impressions: 400,
      likes: 16,
      comments: 3,
      shares: 2,
      clicks: 10,
    });

    expect(liveMetric).not.toBeNull();
    const summary = summarizeSocialMetricsWindow([liveMetric!, demoMetric], [livePost, demoPost]);

    expect(summary.impressions).toBe(1220);
    expect(summary.likes).toBe(47);
    expect(summary.comments).toBe(10);
    expect(summary.shares).toBe(7);
    expect(summary.publishedPosts).toBe(2);
    expect(summary.topProvider).toBe("LINKEDIN");
    expect(summary.averageEngagementPerPublishedPost).toBeGreaterThan(0);
  });

  it("builds LinkedIn live analytics health from healthy, failed, and unsynced live posts", () => {
    const healthyPost = buildPost({
      metadata: {
        publication: { mode: "live", state: "published" },
        analytics: {
          impressions: 820,
          likes: 31,
          comments: 7,
          shares: 5,
          lastFetchedAt: "2026-03-13T10:10:00.000Z",
          source: "live_linkedin",
          lastRefreshStatus: "success",
          lastRefreshErrorCode: null,
          lastRefreshErrorMessage: null,
        },
      },
    });
    const failedPost = buildPost({
      id: "post_2",
      externalPostId: "urn:li:ugcPost:456",
      metadata: {
        publication: { mode: "live", state: "published" },
        analytics: {
          impressions: 700,
          likes: 22,
          comments: 5,
          shares: 3,
          lastFetchedAt: "2026-03-13T10:30:00.000Z",
          source: "analytics_fallback",
          lastRefreshStatus: "error",
          lastRefreshErrorCode: "LINKEDIN_ANALYTICS_REAUTH_REQUIRED",
          lastRefreshErrorMessage: "Reconnect LinkedIn before retrying.",
        },
      },
    });
    const unsyncedPost = buildPost({
      id: "post_3",
      externalPostId: "urn:li:ugcPost:789",
      metadata: {
        publication: { mode: "live", state: "published" },
      },
    });

    const summary = summarizeLinkedInLiveAnalyticsHealth([healthyPost, failedPost, unsyncedPost]);

    expect(summary.totalEligibleLivePosts).toBe(3);
    expect(summary.healthyPosts).toBe(1);
    expect(summary.failedPosts).toBe(1);
    expect(summary.noLiveAnalyticsYetPosts).toBe(1);
    expect(summary.status).toBe("Needs attention");
    expect(summary.lastWorkspaceSyncAt).toBe("2026-03-13T10:30:00.000Z");
    expect(summary.recommendation).toBe("Reconnect LinkedIn and rerun workspace refresh.");
    expect(summary.recentActivity).toHaveLength(2);
    expect(summary.recentActivity[0]?.postTitle).toBe("Launch update");
    expect(summary.recentActivity[0]?.state).toBe("error");
    expect(summary.recentIncidents).toHaveLength(1);
    expect(summary.recentIncidents[0]?.lastRefreshErrorCode).toBe("LINKEDIN_ANALYTICS_REAUTH_REQUIRED");
  });

  it("keeps fallback activity visible without breaking the workspace health summary", () => {
    const fallbackOnlyPost = buildPost({
      metadata: {
        publication: { mode: "live", state: "published" },
        analytics: {
          impressions: 610,
          likes: 18,
          comments: 4,
          shares: 2,
          lastFetchedAt: "2026-03-13T11:00:00.000Z",
          source: "analytics_fallback",
          lastRefreshStatus: "success",
          lastRefreshErrorCode: null,
          lastRefreshErrorMessage: null,
        },
      },
    });

    const summary = summarizeLinkedInLiveAnalyticsHealth([fallbackOnlyPost]);

    expect(summary.totalEligibleLivePosts).toBe(1);
    expect(summary.failedPosts).toBe(1);
    expect(summary.status).toBe("Needs attention");
    expect(summary.recommendation).toBe("One live post still uses fallback analytics.");
    expect(summary.recentActivity[0]?.summary).toBe("Fallback analytics active");
    expect(summary.recentIncidents[0]?.state).toBe("fallback");
  });

  it("surfaces resolved live refresh recovery without keeping the post as an active incident", () => {
    const resolvedPost = buildPost({
      metadata: {
        publication: { mode: "live", state: "published" },
        analytics: {
          impressions: 910,
          likes: 33,
          comments: 6,
          shares: 4,
          lastFetchedAt: "2026-03-13T11:30:00.000Z",
          source: "live_linkedin",
          lastRefreshStatus: "success",
          lastRefreshErrorCode: null,
          lastRefreshErrorMessage: null,
          recoveryStatus: "resolved_by_live_refresh",
          recoveryAt: "2026-03-13T11:30:00.000Z",
        },
      },
    });

    const summary = summarizeLinkedInLiveAnalyticsHealth([resolvedPost], new Date("2026-03-13T12:00:00.000Z"));

    expect(summary.status).toBe("Healthy");
    expect(summary.lastHealthyLiveSyncAt).toBe("2026-03-13T11:30:00.000Z");
    expect(summary.healthySyncFreshnessStatus).toBe("FRESH");
    expect(summary.healthySyncNeedsRefresh).toBe(false);
    expect(summary.resolvedRecently).toBe(true);
    expect(summary.resolvedRecentlyCount).toBe(1);
    expect(summary.lastResolvedAt).toBe("2026-03-13T11:30:00.000Z");
    expect(summary.recentActivity[0]?.state).toBe("resolved");
    expect(summary.recentActivity[0]?.summary).toBe("Resolved by live refresh");
    expect(summary.recentActivity[0]?.recoveryAt).toBe("2026-03-13T11:30:00.000Z");
    expect(summary.recentIncidents).toHaveLength(0);
  });

  it("drops stale recoveries from the workspace health summary while keeping the post healthy", () => {
    const staleRecoveryPost = buildPost({
      metadata: {
        publication: { mode: "live", state: "published" },
        analytics: {
          impressions: 910,
          likes: 33,
          comments: 6,
          shares: 4,
          lastFetchedAt: "2026-03-13T11:30:00.000Z",
          source: "live_linkedin",
          lastRefreshStatus: "success",
          lastRefreshErrorCode: null,
          lastRefreshErrorMessage: null,
          recoveryStatus: "resolved_by_live_refresh",
          recoveryAt: "2026-03-13T11:30:00.000Z",
        },
      },
    });

    const summary = summarizeLinkedInLiveAnalyticsHealth([staleRecoveryPost], new Date("2026-03-15T12:00:00.000Z"));

    expect(summary.status).toBe("Healthy");
    expect(summary.lastHealthyLiveSyncAt).toBe("2026-03-13T11:30:00.000Z");
    expect(summary.healthySyncFreshnessStatus).toBe("AGING");
    expect(summary.healthySyncNeedsRefresh).toBe(true);
    expect(summary.resolvedRecently).toBe(false);
    expect(summary.resolvedRecentlyCount).toBe(0);
    expect(summary.lastResolvedAt).toBeNull();
    expect(summary.recentActivity[0]?.state).toBe("success");
    expect(summary.recentActivity[0]?.summary).toBe("Post synced successfully");
    expect(summary.recentIncidents).toHaveLength(0);
  });

  it("tracks the last healthy live sync even when another live post still has active incidents", () => {
    const healthyPost = buildPost({
      metadata: {
        publication: { mode: "live", state: "published" },
        analytics: {
          impressions: 820,
          likes: 31,
          comments: 7,
          shares: 5,
          lastFetchedAt: "2026-03-13T10:10:00.000Z",
          source: "live_linkedin",
          lastRefreshStatus: "success",
          lastRefreshErrorCode: null,
          lastRefreshErrorMessage: null,
        },
      },
    });
    const failedPost = buildPost({
      id: "post_2",
      externalPostId: "urn:li:ugcPost:456",
      metadata: {
        publication: { mode: "live", state: "published" },
        analytics: {
          impressions: 700,
          likes: 22,
          comments: 5,
          shares: 3,
          lastFetchedAt: "2026-03-13T10:30:00.000Z",
          source: "analytics_fallback",
          lastRefreshStatus: "error",
          lastRefreshErrorCode: "LINKEDIN_ANALYTICS_REAUTH_REQUIRED",
          lastRefreshErrorMessage: "Reconnect LinkedIn before retrying.",
        },
      },
    });

    const summary = summarizeLinkedInLiveAnalyticsHealth([healthyPost, failedPost], new Date("2026-03-13T12:00:00.000Z"));

    expect(summary.status).toBe("Needs attention");
    expect(summary.failedPosts).toBe(1);
    expect(summary.lastHealthyLiveSyncAt).toBe("2026-03-13T10:10:00.000Z");
    expect(summary.healthySyncFreshnessStatus).toBe("FRESH");
    expect(summary.healthySyncNeedsRefresh).toBe(false);
    expect(summary.recentIncidents).toHaveLength(1);
  });

  it("reports healthy sync freshness as not available when no healthy live sync exists yet", () => {
    const fallbackOnlyPost = buildPost({
      metadata: {
        publication: { mode: "live", state: "published" },
        analytics: {
          impressions: 610,
          likes: 18,
          comments: 4,
          shares: 2,
          lastFetchedAt: "2026-03-13T11:00:00.000Z",
          source: "analytics_fallback",
          lastRefreshStatus: "success",
          lastRefreshErrorCode: null,
          lastRefreshErrorMessage: null,
        },
      },
    });

    const summary = summarizeLinkedInLiveAnalyticsHealth([fallbackOnlyPost], new Date("2026-03-13T12:00:00.000Z"));

    expect(summary.lastHealthyLiveSyncAt).toBeNull();
    expect(summary.healthySyncFreshnessStatus).toBe("NOT_AVAILABLE");
    expect(summary.healthySyncNeedsRefresh).toBe(false);
  });
});
