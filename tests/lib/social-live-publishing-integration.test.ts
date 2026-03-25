import { beforeEach, describe, expect, it, vi } from "vitest";

const getSaasSocialPostById = vi.hoisted(() => vi.fn());
const listSaasSocialAccounts = vi.hoisted(() => vi.fn());
const updateSaasSocialPostStatus = vi.hoisted(() => vi.fn());
const markAsPosted = vi.hoisted(() => vi.fn());
const publishPost = vi.hoisted(() => vi.fn());

vi.mock("@/lib/social/repository", () => ({
  getSaasSocialPostById,
  listSaasSocialAccounts,
  updateSaasSocialPostStatus,
  markAsPosted,
}));

vi.mock("@/lib/social/linkedin-service", () => ({
  publishPost,
}));

import { publishSocialPostLive } from "@/lib/social/live-publishing";

describe("social live publishing integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
