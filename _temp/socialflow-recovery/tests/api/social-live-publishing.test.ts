import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireTenantAccess,
  UnauthorizedError,
  resolveSocialContext,
  getSocialAnalyticsSnapshot,
  refreshSocialPostLiveAnalytics,
  refreshSocialWorkspaceLiveAnalytics,
  markSocialPostAnalyticsReviewed,
  upsertSaasSocialAccount,
  verifyLinkedInAccess,
  getSaasSocialPostById,
  publishSocialPostLive,
  runSocialSchedulerSimulation,
  listSaasSocialPosts,
} = vi.hoisted(() => {
  class HoistedUnauthorizedError extends Error {
    status: number;

    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.status = status;
    }
  }

  return {
    requireTenantAccess: vi.fn(),
    resolveSocialContext: vi.fn(),
    getSocialAnalyticsSnapshot: vi.fn(),
    refreshSocialPostLiveAnalytics: vi.fn(),
    refreshSocialWorkspaceLiveAnalytics: vi.fn(),
    markSocialPostAnalyticsReviewed: vi.fn(),
    upsertSaasSocialAccount: vi.fn(),
    verifyLinkedInAccess: vi.fn(),
    getSaasSocialPostById: vi.fn(),
    publishSocialPostLive: vi.fn(),
    runSocialSchedulerSimulation: vi.fn(),
    listSaasSocialPosts: vi.fn(),
    UnauthorizedError: HoistedUnauthorizedError,
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireTenantAccess,
  UnauthorizedError,
}));

vi.mock("../../src/lib/social/repository", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/social/repository")>("../../src/lib/social/repository");
  return {
    ...actual,
    resolveSocialContext,
    getSocialAnalyticsSnapshot,
    refreshSocialPostLiveAnalytics,
    refreshSocialWorkspaceLiveAnalytics,
    markSocialPostAnalyticsReviewed,
    upsertSaasSocialAccount,
    getSaasSocialPostById,
    runSocialSchedulerSimulation,
    listSaasSocialPosts,
  };
});

vi.mock("@/lib/social/linkedin", () => ({
  LinkedInIntegrationError: class LinkedInIntegrationError extends Error {
    code: string;
    accountStatus: string;
    httpStatus: number;

    constructor(message: string, options: { code: string; accountStatus: string; httpStatus?: number }) {
      super(message);
      this.code = options.code;
      this.accountStatus = options.accountStatus;
      this.httpStatus = options.httpStatus ?? 400;
    }
  },
  verifyLinkedInAccess,
}));

vi.mock("@/lib/social/live-publishing", () => ({
  publishSocialPostLive,
}));

import { PATCH as PATCH_POST } from "../../src/app/api/social/posts/[id]/route";
import { POST as POST_ANALYTICS } from "../../src/app/api/social/analytics/route";
import { POST as POST_ACCOUNT } from "../../src/app/api/social/accounts/route";
import { GET as GET_POSTS } from "../../src/app/api/social/posts/route";

describe("Social live publishing contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTenantAccess.mockResolvedValue({ tenantId: "tenant_1" });
    resolveSocialContext.mockResolvedValue({ tenantId: "tenant_1", saasId: "saas_1", mode: "d1" });
    runSocialSchedulerSimulation.mockResolvedValue({ publishedCount: 0, publishedPostIds: [] });
    listSaasSocialPosts.mockResolvedValue([]);
    refreshSocialPostLiveAnalytics.mockReset();
    refreshSocialWorkspaceLiveAnalytics.mockReset();
    markSocialPostAnalyticsReviewed.mockReset();
    getSocialAnalyticsSnapshot.mockResolvedValue({
      last7Days: {
        impressions: 1200,
        likes: 42,
        comments: 5,
        shares: 3,
        clicks: 12,
        engagement: 62,
        publishedPosts: 1,
        topProvider: "LINKEDIN",
        averageEngagementPerPublishedPost: 62,
      },
      last30Days: {
        impressions: 4200,
        likes: 120,
        comments: 18,
        shares: 9,
        clicks: 32,
        engagement: 179,
        publishedPosts: 3,
        topProvider: "LINKEDIN",
        averageEngagementPerPublishedPost: 59.67,
      },
    });
  });

  it("verifies and stores a live LinkedIn account", async () => {
    verifyLinkedInAccess.mockResolvedValue({
      authorUrn: "urn:li:person:abc123",
      displayName: "Ada Lovelace",
      profileId: "abc123",
    });
    upsertSaasSocialAccount.mockResolvedValue({
      id: "acct_1",
      tenantId: "tenant_1",
      saasId: "saas_1",
      provider: "LINKEDIN",
      handle: "@ada",
      displayName: "Ada Lovelace",
      status: "CONNECTED_REAL",
      authMeta: {
        mode: "live",
        accessToken: "token-live",
        authorUrn: "urn:li:person:abc123",
      },
      isPrimary: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await POST_ACCOUNT(
      new Request("https://drako.systems/api/social/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId: "saas_1",
          provider: "LINKEDIN",
          handle: "@ada",
          status: "CONNECTED_REAL",
          authMeta: {
            mode: "live",
            accessToken: "token-live",
          },
          isPrimary: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      account: { status: string; provider: string };
      liveConnection: { ok: boolean };
    };
    expect(payload.account.provider).toBe("LINKEDIN");
    expect(payload.account.status).toBe("CONNECTED_REAL");
    expect(payload.liveConnection.ok).toBe(true);
    expect(verifyLinkedInAccess).toHaveBeenCalledWith("token-live");
  });

  it("publishes one post live through the canonical post route", async () => {
    getSaasSocialPostById.mockResolvedValue({
      id: "post_1",
      tenantId: "tenant_1",
      saasId: "saas_1",
      campaignId: null,
      channelId: null,
      provider: "LINKEDIN",
      contentType: "FEED",
      title: "Launch update",
      body: "We are live on LinkedIn.",
      imageHint: null,
      status: "SCHEDULED",
      scheduledAt: new Date().toISOString(),
      postedAt: null,
      externalPostId: null,
      metadata: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    publishSocialPostLive.mockResolvedValue({
      ok: true,
      account: null,
      post: {
        id: "post_1",
        tenantId: "tenant_1",
        saasId: "saas_1",
        campaignId: null,
        channelId: null,
        provider: "LINKEDIN",
        contentType: "FEED",
        title: "Launch update",
        body: "We are live on LinkedIn.",
        imageHint: null,
        status: "PUBLISHED",
        scheduledAt: null,
        postedAt: "2026-03-13T10:00:00.000Z",
        externalPostId: "urn:li:share:123",
        metadata: {
          publication: {
            mode: "live",
            state: "published",
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    const response = await PATCH_POST(
      new Request("https://drako.systems/api/social/posts/post_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish_live",
        }),
      }),
      { params: Promise.resolve({ id: "post_1" }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      post: { externalPostId: string | null };
      livePublish: { ok: boolean; code: string };
    };
    expect(payload.livePublish.ok).toBe(true);
    expect(payload.post.externalPostId).toBe("urn:li:share:123");
  });

  it("marks the post as failed and requests reconnection when LinkedIn live publishing fails", async () => {
    getSaasSocialPostById.mockResolvedValue({
      id: "post_2",
      tenantId: "tenant_1",
      saasId: "saas_1",
      campaignId: null,
      channelId: null,
      provider: "LINKEDIN",
      contentType: "FEED",
      title: "Reconnect me",
      body: "This one should fail live.",
      imageHint: null,
      status: "SCHEDULED",
      scheduledAt: new Date().toISOString(),
      postedAt: null,
      externalPostId: null,
      metadata: {
        publication: {
          mode: "live",
          state: "scheduled",
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    publishSocialPostLive.mockResolvedValue({
      ok: false,
      code: "INVALID_LINKEDIN_TOKEN",
      message: "LinkedIn credentials are no longer valid.",
      account: {
        id: "acct_1",
        tenantId: "tenant_1",
        saasId: "saas_1",
        provider: "LINKEDIN",
        handle: "@ada",
        displayName: "Ada Lovelace",
        status: "NEEDS_RECONNECTION",
        authMeta: {
          token_status: "invalid",
          lastErrorCode: "INVALID_LINKEDIN_TOKEN",
        },
        isPrimary: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      post: {
        id: "post_2",
        tenantId: "tenant_1",
        saasId: "saas_1",
        campaignId: null,
        channelId: null,
        provider: "LINKEDIN",
        contentType: "FEED",
        title: "Reconnect me",
        body: "This one should fail live.",
        imageHint: null,
        status: "FAILED",
        scheduledAt: new Date().toISOString(),
        postedAt: null,
        externalPostId: null,
        metadata: {
          publication: {
            mode: "live",
            state: "failed",
            errorCode: "INVALID_LINKEDIN_TOKEN",
            errorMessage: "LinkedIn credentials are no longer valid.",
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    const response = await PATCH_POST(
      new Request("https://drako.systems/api/social/posts/post_2", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish_live",
        }),
      }),
      { params: Promise.resolve({ id: "post_2" }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      post: { status: string; metadata?: { publication?: { state?: string; errorCode?: string } } };
      livePublish: { ok: boolean; code: string; message: string };
    };
    expect(payload.livePublish.ok).toBe(false);
    expect(payload.livePublish.code).toBe("INVALID_LINKEDIN_TOKEN");
    expect(payload.post.status).toBe("FAILED");
    expect(payload.post.metadata?.publication?.state).toBe("failed");
    expect(payload.post.metadata?.publication?.errorCode).toBe("INVALID_LINKEDIN_TOKEN");
  });

  it("runs the publish check before listing posts without breaking the demo flow", async () => {
    listSaasSocialPosts.mockResolvedValue([
      {
        id: "post_live",
        tenantId: "tenant_1",
        saasId: "saas_1",
        campaignId: null,
        channelId: null,
        provider: "LINKEDIN",
        contentType: "FEED",
        title: "LinkedIn scheduled live",
        body: "Real scheduled post.",
        imageHint: null,
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() + 60_000).toISOString(),
        postedAt: null,
        externalPostId: null,
        metadata: { publication: { mode: "live", state: "scheduled" } },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "post_demo",
        tenantId: "tenant_1",
        saasId: "saas_1",
        campaignId: null,
        channelId: null,
        provider: "INSTAGRAM",
        contentType: "REEL",
        title: "Instagram demo",
        body: "Demo queue item.",
        imageHint: null,
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() + 120_000).toISOString(),
        postedAt: null,
        externalPostId: null,
        metadata: { publication: { mode: "demo", state: "scheduled" } },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const response = await GET_POSTS(
      new Request("https://drako.systems/api/social/posts?saasId=saas_1"),
    );

    expect(response.status).toBe(200);
    expect(runSocialSchedulerSimulation).toHaveBeenCalledWith({ tenantId: "tenant_1", saasId: "saas_1", mode: "d1" });
    const payload = await response.json() as { count: number; items: Array<{ provider: string }> };
    expect(payload.count).toBe(2);
    expect(payload.items.some((item) => item.provider === "LINKEDIN")).toBe(true);
    expect(payload.items.some((item) => item.provider === "INSTAGRAM")).toBe(true);
  });

  it("refreshes live analytics for one published LinkedIn post", async () => {
    getSaasSocialPostById.mockResolvedValue({
      id: "post_analytics_1",
      tenantId: "tenant_1",
      saasId: "saas_1",
      campaignId: null,
      channelId: null,
      provider: "LINKEDIN",
      contentType: "FEED",
      title: "Analytics me",
      body: "One live post.",
      imageHint: null,
      status: "PUBLISHED",
      scheduledAt: null,
      postedAt: "2026-03-13T12:00:00.000Z",
      externalPostId: "urn:li:ugcPost:123",
      metadata: {
        publication: { mode: "live", state: "published" },
        analytics: {
          impressions: 1440,
          likes: 49,
          comments: 7,
          shares: 4,
          lastFetchedAt: "2026-03-13T13:00:00.000Z",
          source: "analytics_fallback",
          lastRefreshStatus: "error",
          lastRefreshErrorCode: "LINKEDIN_ANALYTICS_REAUTH_REQUIRED",
          lastRefreshErrorMessage: "Reconnect LinkedIn before retrying.",
          manualReviewStatus: "reviewed",
          manualReviewAt: "2026-03-13T13:10:00.000Z",
          manualReviewNote: "Reviewed with the customer before reconnect.",
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    refreshSocialPostLiveAnalytics.mockResolvedValue({
      ok: true,
      code: "LIVE_ANALYTICS_REFRESHED",
      message: "Live analytics refreshed from LinkedIn.",
      account: null,
      post: {
        id: "post_analytics_1",
        tenantId: "tenant_1",
        saasId: "saas_1",
        campaignId: null,
        channelId: null,
        provider: "LINKEDIN",
        contentType: "FEED",
        title: "Analytics me",
        body: "One live post.",
        imageHint: null,
        status: "PUBLISHED",
        scheduledAt: null,
        postedAt: "2026-03-13T12:00:00.000Z",
        externalPostId: "urn:li:ugcPost:123",
        metadata: {
          publication: { mode: "live", state: "published" },
          analytics: {
            impressions: 1840,
            likes: 57,
            comments: 9,
            shares: 5,
            lastFetchedAt: "2026-03-13T14:00:00.000Z",
            source: "live_linkedin",
            lastRefreshStatus: "success",
            lastRefreshErrorCode: null,
            lastRefreshErrorMessage: null,
            manualReviewStatus: undefined,
            manualReviewAt: null,
            manualReviewNote: null,
            recoveryStatus: "resolved_by_live_refresh",
            recoveryAt: "2026-03-13T14:00:00.000Z",
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    const response = await PATCH_POST(
      new Request("https://drako.systems/api/social/posts/post_analytics_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refresh_live_analytics",
        }),
      }),
      { params: Promise.resolve({ id: "post_analytics_1" }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      post: { metadata: { analytics: {
        source: string;
        lastRefreshStatus: string;
        manualReviewStatus?: string;
        manualReviewAt?: string | null;
        manualReviewNote?: string | null;
        recoveryStatus?: string;
        recoveryAt?: string | null;
      } } };
      liveAnalytics: { ok: boolean; code: string };
    };
    expect(payload.liveAnalytics.ok).toBe(true);
    expect(payload.liveAnalytics.code).toBe("LIVE_ANALYTICS_REFRESHED");
    expect(payload.post.metadata.analytics.source).toBe("live_linkedin");
    expect(payload.post.metadata.analytics.lastRefreshStatus).toBe("success");
    expect(payload.post.metadata.analytics.manualReviewStatus).toBeUndefined();
    expect(payload.post.metadata.analytics.manualReviewAt).toBeNull();
    expect(payload.post.metadata.analytics.manualReviewNote).toBeNull();
    expect(payload.post.metadata.analytics.recoveryStatus).toBe("resolved_by_live_refresh");
    expect(payload.post.metadata.analytics.recoveryAt).toBe("2026-03-13T14:00:00.000Z");
  });

  it("marks a degraded live analytics post as reviewed through the canonical post route", async () => {
    getSaasSocialPostById.mockResolvedValue({
      id: "post_analytics_2",
      tenantId: "tenant_1",
      saasId: "saas_1",
      campaignId: null,
      channelId: null,
      provider: "LINKEDIN",
      contentType: "FEED",
      title: "Review this sync",
      body: "Live analytics need manual review.",
      imageHint: null,
      status: "PUBLISHED",
      scheduledAt: null,
      postedAt: "2026-03-13T12:00:00.000Z",
      externalPostId: "urn:li:ugcPost:456",
      metadata: {
        publication: { mode: "live", state: "published" },
        analytics: {
          impressions: 1840,
          likes: 57,
          comments: 9,
          shares: 5,
          lastFetchedAt: "2026-03-13T14:00:00.000Z",
          source: "analytics_fallback",
          lastRefreshStatus: "error",
          lastRefreshErrorCode: "LINKEDIN_ANALYTICS_REAUTH_REQUIRED",
          lastRefreshErrorMessage: "Reconnect LinkedIn before retrying.",
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    markSocialPostAnalyticsReviewed.mockResolvedValue({
      id: "post_analytics_2",
      tenantId: "tenant_1",
      saasId: "saas_1",
      campaignId: null,
      channelId: null,
      provider: "LINKEDIN",
      contentType: "FEED",
      title: "Review this sync",
      body: "Live analytics need manual review.",
      imageHint: null,
      status: "PUBLISHED",
      scheduledAt: null,
      postedAt: "2026-03-13T12:00:00.000Z",
      externalPostId: "urn:li:ugcPost:456",
      metadata: {
        publication: { mode: "live", state: "published" },
        analytics: {
          impressions: 1840,
          likes: 57,
          comments: 9,
          shares: 5,
          lastFetchedAt: "2026-03-13T14:00:00.000Z",
          source: "analytics_fallback",
          lastRefreshStatus: "error",
          lastRefreshErrorCode: "LINKEDIN_ANALYTICS_REAUTH_REQUIRED",
          lastRefreshErrorMessage: "Reconnect LinkedIn before retrying.",
          manualReviewStatus: "reviewed",
          manualReviewAt: "2026-03-13T15:00:00.000Z",
          manualReviewNote: "Reviewed with the customer after reconnect guidance.",
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await PATCH_POST(
      new Request("https://drako.systems/api/social/posts/post_analytics_2", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_analytics_reviewed",
          manualReviewNote: "Reviewed with the customer after reconnect guidance.",
        }),
      }),
      { params: Promise.resolve({ id: "post_analytics_2" }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      post: { metadata: { analytics: { manualReviewStatus?: string; manualReviewAt?: string | null; manualReviewNote?: string | null } } };
      review: { ok: boolean; code: string; message: string };
    };
    expect(payload.review.ok).toBe(true);
    expect(payload.review.code).toBe("LIVE_ANALYTICS_REVIEWED");
    expect(payload.post.metadata.analytics.manualReviewStatus).toBe("reviewed");
    expect(payload.post.metadata.analytics.manualReviewAt).toBe("2026-03-13T15:00:00.000Z");
    expect(payload.post.metadata.analytics.manualReviewNote).toBe("Reviewed with the customer after reconnect guidance.");
    expect(markSocialPostAnalyticsReviewed).toHaveBeenCalledWith(
      { tenantId: "tenant_1", saasId: "saas_1", mode: "d1" },
      "post_analytics_2",
      "Reviewed with the customer after reconnect guidance.",
    );
  });

  it("refreshes live analytics for the workspace and reports counts", async () => {
    refreshSocialWorkspaceLiveAnalytics.mockResolvedValue({
      ok: false,
      refreshedCount: 2,
      failedCount: 1,
      finishedAt: "2026-03-13T15:30:00.000Z",
      message: "2 LinkedIn live posts refreshed, 1 failed.",
      posts: [],
    });

    const response = await POST_ANALYTICS(
      new Request("https://drako.systems/api/social/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId: "saas_1",
          action: "refresh_live_analytics",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      refresh: { ok: boolean; refreshedCount: number; failedCount: number; finishedAt: string };
    };
    expect(payload.refresh.ok).toBe(false);
    expect(payload.refresh.refreshedCount).toBe(2);
    expect(payload.refresh.failedCount).toBe(1);
    expect(payload.refresh.finishedAt).toBe("2026-03-13T15:30:00.000Z");
  });
});
