import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveSocialContext,
  listSaasSocialPosts,
  listSaasSocialAccounts,
  getSocialAnalyticsSnapshot,
  getObservabilityStatusSummary,
  listObservabilityActivities,
  listObservabilityIncidents,
  listPublishActivities,
} = vi.hoisted(() => ({
  resolveSocialContext: vi.fn(),
  listSaasSocialPosts: vi.fn(),
  listSaasSocialAccounts: vi.fn(),
  getSocialAnalyticsSnapshot: vi.fn(),
  getObservabilityStatusSummary: vi.fn(),
  listObservabilityActivities: vi.fn(),
  listObservabilityIncidents: vi.fn(),
  listPublishActivities: vi.fn(),
}));

vi.mock("@/lib/socialflow/repository", () => ({
  resolveSocialContext,
  listSaasSocialPosts,
  listSaasSocialAccounts,
  getSocialAnalyticsSnapshot,
}));

vi.mock("@/lib/observability-core", () => ({
  getObservabilityStatusSummary,
  listObservabilityActivities,
  listObservabilityIncidents,
}));

vi.mock("@/lib/socialflow/publish-activity", () => ({
  listPublishActivities,
}));

import { getSocialFlowOperatorObservability } from "@/lib/socialflow/contracts/observability";

const now = Date.parse("2026-05-03T08:00:00.000Z");

function post(overrides: Record<string, unknown>) {
  return {
    id: "post-1",
    tenantId: "tenant-1",
    saasId: "socialflow",
    channelId: null,
    campaignId: null,
    provider: "LINKEDIN",
    contentType: "FEED",
    title: "Post",
    body: "Body",
    imageHint: null,
    status: "SCHEDULED",
    scheduledAt: null,
    postedAt: null,
    externalPostId: null,
    metadata: null,
    createdAt: "2026-05-03T07:00:00.000Z",
    updatedAt: "2026-05-03T07:00:00.000Z",
    ...overrides,
  };
}

describe("SocialFlow operator observability contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(now);
    resolveSocialContext.mockResolvedValue({ tenantId: "tenant-1", saasId: "socialflow" });
    getSocialAnalyticsSnapshot.mockResolvedValue({
      last7Days: {
        engagement: 12,
        publishedPosts: 1,
        topProvider: "LINKEDIN",
      },
      last30Days: {
        engagement: 30,
        publishedPosts: 2,
        topProvider: "LINKEDIN",
      },
    });
    getObservabilityStatusSummary.mockResolvedValue({
      tenantId: "tenant-1",
      saasId: "socialflow",
      overallStatus: "healthy",
      freshnessStatus: "fresh",
      openIncidentsCount: 0,
      latestActivityAt: "2026-05-03T07:50:00.000Z",
      latestSnapshotAt: "2026-05-03T07:55:00.000Z",
      recommendation: "Operational activity looks recent.",
    });
    listObservabilityActivities.mockResolvedValue([
      {
        id: "activity-1",
        tenantId: "tenant-1",
        saasId: "socialflow",
        sourceType: "integration",
        sourceKey: "post:posted-1",
        activityType: "publish_succeeded",
        status: "success",
        summary: "Published",
        metadata: null,
        createdAt: "2026-05-03T07:50:00.000Z",
      },
    ]);
    listObservabilityIncidents.mockResolvedValue([]);
    listPublishActivities.mockResolvedValue([]);
    listSaasSocialAccounts.mockResolvedValue([
      {
        id: "account-1",
        tenantId: "tenant-1",
        saasId: "socialflow",
        provider: "LINKEDIN",
        handle: "drako",
        displayName: "Drako",
        status: "CONNECTED_REAL",
        authMeta: null,
        isPrimary: true,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-03T07:00:00.000Z",
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns operator-safe health, scheduler, publishing and LinkedIn state", async () => {
    listSaasSocialPosts.mockResolvedValue([
      post({
        id: "scheduled-1",
        status: "SCHEDULED",
        scheduledAt: "2026-05-03T07:55:00.000Z",
      }),
      post({
        id: "stale-1",
        title: "Stale publish",
        status: "PUBLISHING",
        updatedAt: "2026-05-03T07:40:00.000Z",
      }),
      post({
        id: "posted-1",
        title: "Published",
        status: "POSTED",
        postedAt: "2026-05-03T07:30:00.000Z",
        externalPostId: "urn:li:share:1",
      }),
      post({
        id: "failed-1",
        title: "Failed",
        status: "FAILED",
        updatedAt: "2026-05-03T07:20:00.000Z",
        metadata: {
          publication: {
            attempts: 3,
            lastErrorCode: "LINKEDIN_PUBLISH_FAILED",
            lastErrorMessage: "temporary timeout",
          },
        },
      }),
    ]);

    const result = await getSocialFlowOperatorObservability({
      tenantId: "tenant-1",
      saasId: "socialflow",
    });

    expect(result.health.status).toBe("needs_attention");
    expect(result.health.schedulerStatus).toBe("needs_attention");
    expect(result.scheduler.dueScheduledPosts).toBe(1);
    expect(result.scheduler.stalePublishingPosts).toBe(1);
    expect(result.posts.byStatus.SCHEDULED).toBe(1);
    expect(result.posts.byStatus.PUBLISHING).toBe(1);
    expect(result.posts.byStatus.POSTED).toBe(1);
    expect(result.posts.byStatus.FAILED).toBe(1);
    expect(result.publishing.successLast30Days).toBe(1);
    expect(result.publishing.failedLast30Days).toBe(1);
    expect(result.publishing.successRateLast30Days).toBe(0.5);
    expect(result.linkedin.connected).toBe(true);
    expect(result.linkedin.primaryStatus).toBe("CONNECTED_REAL");
    expect(result.recentEvents).toHaveLength(1);
  });

  it("merges SOCIAL_DB publish activity with legacy observability events, newest first", async () => {
    const socialDb = {} as D1Database;
    resolveSocialContext.mockResolvedValue({ tenantId: "tenant-1", saasId: "socialflow", socialDb });
    listSaasSocialPosts.mockResolvedValue([]);
    listPublishActivities.mockResolvedValue([
      {
        id: "pa-1",
        tenantId: "tenant-1",
        saasId: "socialflow",
        postId: "post-9",
        activityType: "publish_failed",
        status: "error",
        summary: "Attempts exhausted",
        metadata: { errorCode: "INSTAGRAM_PUBLISH_FAILED" },
        createdAt: "2026-05-03T07:59:00.000Z",
      },
    ]);

    const result = await getSocialFlowOperatorObservability({ tenantId: "tenant-1", saasId: "socialflow" });

    expect(listPublishActivities).toHaveBeenCalledWith(socialDb, { tenantId: "tenant-1", saasId: "socialflow", limit: 10 });
    expect(result.recentEvents.map((event) => event.id)).toEqual(["pa-1", "activity-1"]);
    expect(result.recentEvents[0]).toMatchObject({ sourceKey: "post:post-9", activityType: "publish_failed", status: "error" });
    expect(result.health.latestActivityAt).toBe("2026-05-03T07:59:00.000Z");
  });

  it("fails closed on missing contract scope", async () => {
    await expect(getSocialFlowOperatorObservability({ tenantId: "", saasId: "socialflow" }))
      .rejects.toThrow("SOCIALFLOW_OBSERVABILITY_TENANT_REQUIRED");
    await expect(getSocialFlowOperatorObservability({ tenantId: "tenant-1", saasId: "" }))
      .rejects.toThrow("SOCIALFLOW_OBSERVABILITY_SAAS_REQUIRED");
  });
});
