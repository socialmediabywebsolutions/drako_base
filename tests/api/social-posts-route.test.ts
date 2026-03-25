import { beforeEach, describe, expect, it, vi } from "vitest";

const requireTenantAccess = vi.hoisted(() => vi.fn());
const resolveSocialContext = vi.hoisted(() => vi.fn());
const upsertSaasSocialPost = vi.hoisted(() => vi.fn());
const getSaasSocialPostById = vi.hoisted(() => vi.fn());
const publishSocialPostLive = vi.hoisted(() => vi.fn());
const UnauthorizedError = vi.hoisted(() => class UnauthorizedError extends Error {
  status: number;

  constructor(message = "Unauthorized", status = 401) {
    super(message);
    this.status = status;
  }
});

const SocialContextError = vi.hoisted(() => class SocialContextError extends Error {});

vi.mock("@/lib/auth/session", () => ({
  requireTenantAccess,
  UnauthorizedError,
}));

vi.mock("@/lib/social/repository", () => ({
  approvePost: vi.fn(),
  getSaasSocialPostById,
  listSaasSocialPosts: vi.fn(),
  markAsPosted: vi.fn(),
  rejectPost: vi.fn(),
  resolveSocialContext,
  runSocialSchedulerSimulation: vi.fn(),
  schedulePost: vi.fn(),
  SocialContextError,
  upsertSaasSocialPost,
}));

vi.mock("@/lib/social/live-publishing", () => ({
  publishSocialPostLive,
}));

import { POST } from "@/app/api/social/posts/route";

describe("/api/social/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTenantAccess.mockResolvedValue({ tenantId: "tenant_socialflow" });
    resolveSocialContext.mockResolvedValue({ tenantId: "tenant_socialflow", saasId: "socialflow", mode: "d1", socialDb: {} });
    upsertSaasSocialPost.mockResolvedValue({
      id: "post-1",
      saasId: "socialflow",
      provider: "LINKEDIN",
      status: "DRAFT",
    });
    getSaasSocialPostById.mockResolvedValue({
      id: "post-1",
      saasId: "socialflow",
      provider: "LINKEDIN",
      status: "DRAFT",
    });
    publishSocialPostLive.mockResolvedValue({
      ok: true,
      code: "PUBLISHED_LIVE_LINKEDIN",
      message: "Post published successfully to LinkedIn",
      externalPostId: "urn:li:share:123",
      post: {
        id: "post-1",
        status: "POSTED",
        externalPostId: "urn:li:share:123",
      },
    });
  });

  it("publishes immediately for the simplified contract without scheduledAt", async () => {
    const response = await POST(new Request("https://drako.local/api/social/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saasId: "socialflow",
        content: "Hello LinkedIn from SocialFlow",
      }),
    }) as any);

    expect(response.status).toBe(200);
    expect(upsertSaasSocialPost).toHaveBeenCalled();
    expect(publishSocialPostLive).toHaveBeenCalledWith(
      expect.objectContaining({ saasId: "socialflow" }),
      "post-1",
    );
    const payload = await response.json() as { livePublish: { ok: boolean; externalPostId: string } };
    expect(payload.livePublish.ok).toBe(true);
    expect(payload.livePublish.externalPostId).toBe("urn:li:share:123");
  });

  it("stores the post as scheduled when scheduledAt is provided", async () => {
    const response = await POST(new Request("https://drako.local/api/social/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saasId: "socialflow",
        content: "Scheduled post",
        scheduledAt: "2026-03-25T12:00:00.000Z",
      }),
    }) as any);

    expect(response.status).toBe(200);
    expect(publishSocialPostLive).not.toHaveBeenCalled();
    expect(upsertSaasSocialPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: "SCHEDULED",
        scheduledAt: "2026-03-25T12:00:00.000Z",
      }),
    );
  });

  it("returns explicit validation details for invalid body", async () => {
    const response = await POST(new Request("https://drako.local/api/social/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Missing saasId",
      }),
    }) as any);

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      code: "INVALID_BODY",
      message: "saasId, provider, contentType, title, body and status are required",
      details: {
        requiredFields: ["saasId", "provider", "contentType", "title", "body", "status"],
        simplifiedContract: ["saasId", "content", "scheduledAt?"],
      },
    });
  });

  it("returns explicit JSON when SOCIAL_DB is unavailable in local runtime", async () => {
    resolveSocialContext.mockRejectedValue(new SocialContextError("SOCIAL_DB not configured"));

    const response = await POST(new Request("https://drako.local/api/social/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saasId: "socialflow",
        content: "Hello LinkedIn from SocialFlow",
      }),
    }) as any);

    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      code: "SOCIAL_DB_UNAVAILABLE",
      message: "SOCIAL_DB is not configured in the current local runtime.",
      details: expect.objectContaining({
        binding: "SOCIAL_DB",
      }),
    });
  });
});
