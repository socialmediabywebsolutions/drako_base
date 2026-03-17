import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireTenantAccess,
  UnauthorizedError,
  resolveSocialContext,
  runSocialSchedulerSimulation,
  listSaasSocialPosts,
  upsertSaasSocialPost,
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
    runSocialSchedulerSimulation: vi.fn(),
    listSaasSocialPosts: vi.fn(),
    upsertSaasSocialPost: vi.fn(),
    UnauthorizedError: HoistedUnauthorizedError,
  };
});

vi.mock("@/lib/auth/session", () => ({ requireTenantAccess, UnauthorizedError }));
vi.mock("../../src/lib/social/repository", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/social/repository")>("../../src/lib/social/repository");
  return {
    ...actual,
    resolveSocialContext,
    runSocialSchedulerSimulation,
    listSaasSocialPosts,
    upsertSaasSocialPost,
  };
});

import { GET as GET_POSTS, POST as POST_POSTS } from "../../src/app/api/social/posts/route";

describe("SocialFlow minimal post API (LinkedIn-only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTenantAccess.mockResolvedValue({ tenantId: "tenant_1" });
    resolveSocialContext.mockResolvedValue({ tenantId: "tenant_1", saasId: "saas_1", mode: "d1" });
    runSocialSchedulerSimulation.mockResolvedValue({ publishedCount: 0, publishedPostIds: [] });
  });

  it("creates a LinkedIn draft post with trimmed fields", async () => {
    upsertSaasSocialPost.mockResolvedValue({
      id: "post_1",
      tenantId: "tenant_1",
      saasId: "saas_1",
      campaignId: null,
      channelId: null,
      provider: "LINKEDIN",
      contentType: "FEED",
      title: "Hello",
      body: "Hi there",
      imageHint: null,
      status: "DRAFT",
      scheduledAt: null,
      postedAt: null,
      externalPostId: null,
      metadata: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await POST_POSTS(
      new Request("https://drako.systems/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId: "saas_1",
          provider: "LINKEDIN",
          contentType: "FEED",
          title: "  Hello  ",
          body: "  Hi there ",
          status: "DRAFT",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertSaasSocialPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        provider: "LINKEDIN",
        contentType: "FEED",
        title: "Hello",
        body: "Hi there",
        status: "DRAFT",
        channelId: null,
      }),
    );
    const payload = (await response.json()) as { post: { provider: string; status: string } };
    expect(payload.post.provider).toBe("LINKEDIN");
    expect(payload.post.status).toBe("DRAFT");
  });

  it("rejects non-LinkedIn providers", async () => {
    const response = await POST_POSTS(
      new Request("https://drako.systems/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId: "saas_1",
          provider: "INSTAGRAM",
          contentType: "FEED",
          title: "Hello",
          body: "Hi",
          status: "DRAFT",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { code?: string };
    expect(payload.code).toBe("INVALID_PROVIDER");
  });

  it("rejects creation statuses other than draft/scheduled", async () => {
    const response = await POST_POSTS(
      new Request("https://drako.systems/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId: "saas_1",
          provider: "LINKEDIN",
          contentType: "FEED",
          title: "Hello",
          body: "Hi",
          status: "PUBLISHED",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { code?: string; message?: string };
    expect(payload.code).toBe("INVALID_STATUS");
  });

  it("lists posts only after running the scheduler simulation", async () => {
    listSaasSocialPosts.mockResolvedValue([]);
    const response = await GET_POSTS(new Request("https://drako.systems/api/social/posts?saasId=saas_1"));

    expect(response.status).toBe(200);
    expect(runSocialSchedulerSimulation).toHaveBeenCalledWith({ tenantId: "tenant_1", saasId: "saas_1", mode: "d1" });
    expect(listSaasSocialPosts).toHaveBeenCalledWith(
      { tenantId: "tenant_1", saasId: "saas_1", mode: "d1" },
      expect.objectContaining({ provider: null }),
    );
  });
});
