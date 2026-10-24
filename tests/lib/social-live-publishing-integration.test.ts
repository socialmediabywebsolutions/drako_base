import { beforeEach, describe, expect, it, vi } from "vitest";

const getSaasSocialPostById = vi.hoisted(() => vi.fn());
const listSaasSocialAccounts = vi.hoisted(() => vi.fn());
const updateSaasSocialPostStatus = vi.hoisted(() => vi.fn());
const markAsPosted = vi.hoisted(() => vi.fn());
const upsertSaasSocialPost = vi.hoisted(() => vi.fn());
const claimScheduledPostForPublishing = vi.hoisted(() => vi.fn());
const publishPost = vi.hoisted(() => vi.fn());
const recordPublishActivity = vi.hoisted(() => vi.fn());

vi.mock("@/lib/socialflow/repository", () => ({
  getSaasSocialPostById,
  listSaasSocialAccounts,
  updateSaasSocialPostStatus,
  markAsPosted,
  upsertSaasSocialPost,
  claimScheduledPostForPublishing,
}));

vi.mock("@/lib/socialflow/linkedin/publishing", () => ({
  publishPost,
}));

vi.mock("@/lib/socialflow/publish-activity", () => ({
  recordPublishActivity,
}));

import { publishSocialPostLive } from "@/lib/socialflow/live-publishing";

describe("social live publishing integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    upsertSaasSocialPost.mockImplementation(async (_ctx, input) => ({
      tenantId: "tenant-a",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      ...input,
    }));
    claimScheduledPostForPublishing.mockResolvedValue(true);
    recordPublishActivity.mockResolvedValue(undefined);
  });

  it("publishes LinkedIn post through the persisted social account", async () => {
    getSaasSocialPostById.mockResolvedValue({
      id: "post-1",
      tenantId: "tenant-a",
      saasId: "saas-a",
      provider: "LINKEDIN",
      title: "Hello",
      body: "World",
      status: "SCHEDULED",
      channelId: null,
      campaignId: null,
      contentType: "FEED",
      imageHint: null,
      scheduledAt: null,
      postedAt: null,
      externalPostId: null,
      metadata: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    listSaasSocialAccounts.mockResolvedValue([
      { id: "account-1", provider: "LINKEDIN", isPrimary: true, authMeta: { accessToken: "token", authorUrn: "urn:li:person:123" } },
    ]);
    publishPost.mockResolvedValue({
      externalPostId: "urn:li:share:123",
      linkedinStatus: 201,
      body: { id: "urn:li:share:123" },
    });
    markAsPosted.mockResolvedValue({
      id: "post-1",
      status: "POSTED",
      externalPostId: "urn:li:share:123",
    });

    const result = await publishSocialPostLive(
      { tenantId: "tenant-a", saasId: "saas-a", mode: "d1", socialDb: {} as D1Database },
      "post-1",
    );

    expect(publishPost).toHaveBeenCalledWith(
      expect.objectContaining({ id: "account-1" }),
      "World",
    );
    expect(markAsPosted).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "post-1",
        externalPostId: "urn:li:share:123",
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.externalPostId).toBe("urn:li:share:123");
  });

  it("retries transient publish errors before succeeding", async () => {
    vi.useFakeTimers();

    const post = {
      id: "post-1",
      tenantId: "tenant-a",
      saasId: "saas-a",
      provider: "LINKEDIN",
      title: "Hello",
      body: "World",
      status: "SCHEDULED",
      channelId: null,
      campaignId: null,
      contentType: "FEED",
      imageHint: null,
      scheduledAt: null,
      postedAt: null,
      externalPostId: null,
      metadata: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    getSaasSocialPostById.mockResolvedValue(post);
    listSaasSocialAccounts.mockResolvedValue([
      { id: "account-1", provider: "LINKEDIN", isPrimary: true, authMeta: { accessToken: "token", authorUrn: "urn:li:person:123" } },
    ]);
    publishPost
      .mockRejectedValueOnce(new Error("temporary timeout"))
      .mockRejectedValueOnce(new Error("temporary upstream failure"))
      .mockResolvedValueOnce({
        externalPostId: "urn:li:share:456",
        linkedinStatus: 201,
        body: { id: "urn:li:share:456" },
      });
    markAsPosted.mockResolvedValue({
      id: "post-1",
      status: "POSTED",
      externalPostId: "urn:li:share:456",
    });

    const resultPromise = publishSocialPostLive(
      { tenantId: "tenant-a", saasId: "saas-a", mode: "d1", socialDb: {} as D1Database },
      "post-1",
    );

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(publishPost).toHaveBeenCalledTimes(3);
    expect(updateSaasSocialPostStatus).not.toHaveBeenCalled();
    expect(markAsPosted).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.externalPostId).toBe("urn:li:share:456");
  });

  it("marks failed only after exhausting retries", async () => {
    vi.useFakeTimers();

    const post = {
      id: "post-1",
      tenantId: "tenant-a",
      saasId: "saas-a",
      provider: "LINKEDIN",
      title: "Hello",
      body: "World",
      status: "SCHEDULED",
      channelId: null,
      campaignId: null,
      contentType: "FEED",
      imageHint: null,
      scheduledAt: null,
      postedAt: null,
      externalPostId: null,
      metadata: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    getSaasSocialPostById.mockResolvedValue(post);
    listSaasSocialAccounts.mockResolvedValue([
      { id: "account-1", provider: "LINKEDIN", isPrimary: true, authMeta: { accessToken: "token", authorUrn: "urn:li:person:123" } },
    ]);
    publishPost.mockRejectedValue(new Error("temporary timeout"));
    updateSaasSocialPostStatus.mockResolvedValue({
      ...post,
      status: "FAILED",
    });

    const resultPromise = publishSocialPostLive(
      { tenantId: "tenant-a", saasId: "saas-a", mode: "d1", socialDb: {} as D1Database },
      "post-1",
    );

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(publishPost).toHaveBeenCalledTimes(3);
    expect(updateSaasSocialPostStatus).toHaveBeenCalledTimes(1);
    expect(updateSaasSocialPostStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "post-1", status: "FAILED" }),
    );
    expect(result.ok).toBe(false);
  });

  it("does not republish posts already marked as posted", async () => {
    getSaasSocialPostById.mockResolvedValue({
      id: "post-1",
      tenantId: "tenant-a",
      saasId: "saas-a",
      provider: "LINKEDIN",
      title: "Hello",
      body: "World",
      status: "POSTED",
      channelId: null,
      campaignId: null,
      contentType: "FEED",
      imageHint: null,
      scheduledAt: null,
      postedAt: "2024-01-01T00:05:00.000Z",
      externalPostId: "urn:li:share:123",
      metadata: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:05:00.000Z",
    });

    const result = await publishSocialPostLive(
      { tenantId: "tenant-a", saasId: "saas-a", mode: "d1", socialDb: {} as D1Database },
      "post-1",
    );

    expect(publishPost).not.toHaveBeenCalled();
    expect(markAsPosted).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.code).toBe("ALREADY_PUBLISHED");
  });

  it("claims SCHEDULED post atomically before publishing", async () => {
    getSaasSocialPostById.mockResolvedValue({
      id: "post-1",
      tenantId: "tenant-a",
      saasId: "saas-a",
      provider: "LINKEDIN",
      title: "Hello",
      body: "World",
      status: "SCHEDULED",
      channelId: null,
      campaignId: null,
      contentType: "FEED",
      imageHint: null,
      scheduledAt: "2024-01-01T00:00:00.000Z",
      postedAt: null,
      externalPostId: null,
      metadata: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    listSaasSocialAccounts.mockResolvedValue([
      { id: "account-1", provider: "LINKEDIN", isPrimary: true, authMeta: { accessToken: "token", authorUrn: "urn:li:person:123" } },
    ]);
    publishPost.mockResolvedValue({ externalPostId: "urn:li:share:789", linkedinStatus: 201 });
    markAsPosted.mockResolvedValue({ id: "post-1", status: "POSTED" });

    await publishSocialPostLive(
      { tenantId: "tenant-a", saasId: "saas-a", mode: "d1", socialDb: {} as D1Database },
      "post-1",
    );

    expect(claimScheduledPostForPublishing).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-a" }),
      "post-1",
    );
  });

  it("rejects if claim fails (double-pick protection)", async () => {
    claimScheduledPostForPublishing.mockResolvedValue(false);
    getSaasSocialPostById.mockResolvedValue({
      id: "post-1",
      tenantId: "tenant-a",
      saasId: "saas-a",
      provider: "LINKEDIN",
      title: "Hello",
      body: "World",
      status: "SCHEDULED",
      channelId: null,
      campaignId: null,
      contentType: "FEED",
      imageHint: null,
      scheduledAt: "2024-01-01T00:00:00.000Z",
      postedAt: null,
      externalPostId: null,
      metadata: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const result = await publishSocialPostLive(
      { tenantId: "tenant-a", saasId: "saas-a", mode: "d1", socialDb: {} as D1Database },
      "post-1",
    );

    expect(result.ok).toBe(false);
    expect(result.code).toBe("CLAIM_FAILED");
    expect(publishPost).not.toHaveBeenCalled();
  });

  it("recovers idempotency when externalPostId exists but status is not POSTED", async () => {
    getSaasSocialPostById.mockResolvedValue({
      id: "post-1",
      tenantId: "tenant-a",
      saasId: "saas-a",
      provider: "LINKEDIN",
      title: "Hello",
      body: "World",
      status: "SCHEDULED",
      channelId: null,
      campaignId: null,
      contentType: "FEED",
      imageHint: null,
      scheduledAt: null,
      postedAt: null,
      externalPostId: "urn:li:share:existing",
      metadata: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    markAsPosted.mockResolvedValue({ id: "post-1", status: "POSTED", externalPostId: "urn:li:share:existing" });

    const result = await publishSocialPostLive(
      { tenantId: "tenant-a", saasId: "saas-a", mode: "d1", socialDb: {} as D1Database },
      "post-1",
    );

    expect(result.ok).toBe(true);
    expect(result.code).toBe("IDEMPOTENCY_RECOVERED");
    expect(publishPost).not.toHaveBeenCalled();
    expect(markAsPosted).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "post-1", externalPostId: "urn:li:share:existing" }),
    );
  });

  it("skips claim when skipClaim option is set", async () => {
    getSaasSocialPostById.mockResolvedValue({
      id: "post-1",
      tenantId: "tenant-a",
      saasId: "saas-a",
      provider: "LINKEDIN",
      title: "Hello",
      body: "World",
      status: "DRAFT",
      channelId: null,
      campaignId: null,
      contentType: "FEED",
      imageHint: null,
      scheduledAt: null,
      postedAt: null,
      externalPostId: null,
      metadata: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    listSaasSocialAccounts.mockResolvedValue([
      { id: "account-1", provider: "LINKEDIN", isPrimary: true, authMeta: { accessToken: "token", authorUrn: "urn:li:person:123" } },
    ]);
    publishPost.mockResolvedValue({ externalPostId: "urn:li:share:999", linkedinStatus: 201 });
    markAsPosted.mockResolvedValue({ id: "post-1", status: "POSTED" });

    await publishSocialPostLive(
      { tenantId: "tenant-a", saasId: "saas-a", mode: "d1", socialDb: {} as D1Database },
      "post-1",
      { skipClaim: true },
    );

    expect(claimScheduledPostForPublishing).not.toHaveBeenCalled();
    expect(publishPost).toHaveBeenCalled();
  });

  it("records publish activity in SOCIAL_DB on successful publish", async () => {
    getSaasSocialPostById.mockResolvedValue({
      id: "post-1",
      tenantId: "tenant-a",
      saasId: "saas-a",
      provider: "LINKEDIN",
      title: "Hello",
      body: "World",
      status: "DRAFT",
      channelId: null,
      campaignId: null,
      contentType: "FEED",
      imageHint: null,
      scheduledAt: null,
      postedAt: null,
      externalPostId: null,
      metadata: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    listSaasSocialAccounts.mockResolvedValue([
      { id: "account-1", provider: "LINKEDIN", isPrimary: true, authMeta: { accessToken: "token", authorUrn: "urn:li:person:123" } },
    ]);
    publishPost.mockResolvedValue({ externalPostId: "urn:li:share:obs", linkedinStatus: 201 });
    markAsPosted.mockResolvedValue({ id: "post-1", status: "POSTED" });

    await publishSocialPostLive(
      { tenantId: "tenant-a", saasId: "saas-a", mode: "d1", socialDb: {} as D1Database },
      "post-1",
      { skipClaim: true },
    );

    const socialDb = expect.anything();
    expect(recordPublishActivity).toHaveBeenCalledWith(
      socialDb,
      expect.objectContaining({ postId: "post-1", activityType: "publish_started", status: "info" }),
    );
    expect(recordPublishActivity).toHaveBeenCalledWith(
      socialDb,
      expect.objectContaining({ postId: "post-1", activityType: "publish_succeeded", status: "success" }),
    );
  });
});
