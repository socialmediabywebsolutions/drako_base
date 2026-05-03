import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listSaasSocialPosts,
  resolveSocialContext,
  schedulePost,
  recordObservabilityActivity,
} = vi.hoisted(() => ({
  listSaasSocialPosts: vi.fn(),
  resolveSocialContext: vi.fn(),
  schedulePost: vi.fn(),
  recordObservabilityActivity: vi.fn(),
}));

vi.mock("@/lib/socialflow/repository", () => ({
  listSaasSocialPosts,
  resolveSocialContext,
  schedulePost,
}));

vi.mock("@/lib/observability-core", () => ({
  recordObservabilityActivity,
}));

import { runSocialFlowOperatorAction } from "@/lib/socialflow/contracts/operator-actions";

const ctx = {
  tenantId: "tenant-1",
  saasId: "socialflow-main",
  mode: "d1",
  socialDb: {},
};

function post(overrides: Record<string, unknown>) {
  return {
    id: "post-1",
    tenantId: "tenant-1",
    saasId: "socialflow-main",
    channelId: "channel-1",
    campaignId: "campaign-1",
    provider: "LINKEDIN",
    contentType: "FEED",
    title: "Post",
    body: "Body",
    imageHint: null,
    status: "PUBLISHING",
    scheduledAt: "2026-05-03T08:00:00.000Z",
    postedAt: null,
    externalPostId: null,
    metadata: null,
    createdAt: "2026-05-03T07:00:00.000Z",
    updatedAt: "2026-05-03T07:30:00.000Z",
    ...overrides,
  };
}

describe("SocialFlow operator actions contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T08:00:00.000Z"));
    vi.clearAllMocks();
    resolveSocialContext.mockResolvedValue(ctx);
    recordObservabilityActivity.mockResolvedValue({});
  });

  it("recovers stale PUBLISHING posts by scheduling them again", async () => {
    listSaasSocialPosts.mockResolvedValue([post({})]);
    schedulePost.mockResolvedValue(post({ status: "SCHEDULED", updatedAt: "2026-05-03T08:00:00.000Z" }));

    const result = await runSocialFlowOperatorAction({
      action: "recover_stale_publishing",
      tenantId: "tenant-1",
      saasId: "socialflow-main",
    });

    expect(resolveSocialContext).toHaveBeenCalledWith({ tenantId: "tenant-1", saasId: "socialflow-main" });
    expect(listSaasSocialPosts).toHaveBeenCalledWith(ctx, { status: "PUBLISHING" });
    expect(schedulePost).toHaveBeenCalledWith(ctx, {
      id: "post-1",
      scheduledAt: "2026-05-03T08:00:00.000Z",
    });
    expect(result.affected).toBe(1);
    expect(result.message).toBe("Recovered 1 stale PUBLISHING post(s).");
    expect(recordObservabilityActivity).toHaveBeenCalledWith(expect.objectContaining({
      activityType: "recover_stale_publishing",
      status: "success",
    }));
  });

  it("queues failed posts for retry without publishing directly", async () => {
    listSaasSocialPosts.mockResolvedValue([post({ status: "FAILED", scheduledAt: null })]);
    schedulePost.mockResolvedValue(post({ status: "SCHEDULED", scheduledAt: "2026-05-03T08:00:00.000Z" }));

    const result = await runSocialFlowOperatorAction({
      action: "retry_failed_posts",
      tenantId: "tenant-1",
      saasId: "socialflow-main",
    });

    expect(listSaasSocialPosts).toHaveBeenCalledWith(ctx, { status: "FAILED" });
    expect(schedulePost).toHaveBeenCalledWith(ctx, {
      id: "post-1",
      scheduledAt: "2026-05-03T08:00:00.000Z",
    });
    expect(result.affected).toBe(1);
    expect(result.message).toBe("Queued 1 failed post(s) for retry.");
  });

  it("skips posts with external ids to avoid duplicate publication risk", async () => {
    listSaasSocialPosts.mockResolvedValue([
      post({ status: "FAILED", externalPostId: "urn:li:share:1" }),
    ]);

    const result = await runSocialFlowOperatorAction({
      action: "retry_failed_posts",
      tenantId: "tenant-1",
      saasId: "socialflow-main",
    });

    expect(schedulePost).not.toHaveBeenCalled();
    expect(result.affected).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.items[0]?.reason).toBe("EXTERNAL_POST_ID_PRESENT");
  });
});
