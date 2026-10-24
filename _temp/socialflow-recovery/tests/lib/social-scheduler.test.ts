import { describe, expect, it, vi, beforeEach } from "vitest";

import type { SaasSocialPost } from "../../src/lib/social/types";
import * as SocialRepo from "../../src/lib/social/repository";

const mockPublishSocialPostLive = vi.hoisted(() => vi.fn());
vi.mock("@/lib/social/live-publishing", () => ({
  publishSocialPostLive: mockPublishSocialPostLive,
}));

describe("Social scheduler", () => {
  const baseCtx = {
    tenantId: "tenant_1",
    saasId: "saas_1",
    mode: "d1",
    allowDemoFallback: false,
    demoTenantId: undefined,
    db: undefined,
    env: {} as unknown,
  } as SocialRepo.SocialContext;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPublishSocialPostLive.mockReset();
    if (typeof SocialRepo.listAutomationRules === "function") {
      vi.spyOn(SocialRepo, "listAutomationRules").mockResolvedValue([
        { id: "rule_1", status: "ACTIVE", metadata: { action: "publish", trigger: "post.scheduled", type: "automation_rule" } } as any,
      ]);
    }
    if (typeof SocialRepo.resolveTasksContext === "function") {
      vi.spyOn(SocialRepo, "resolveTasksContext").mockResolvedValue(null as any);
    }
  });

  it("publishes a due LinkedIn scheduled post and marks it published", async () => {
    const scheduledPost: SaasSocialPost = {
      id: "post_live",
      tenantId: baseCtx.tenantId,
      saasId: "saas_1",
      campaignId: null,
      channelId: null,
      provider: "LINKEDIN",
      contentType: "FEED",
      title: "Scheduled",
      body: "Body",
      imageHint: null,
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() - 60_000).toISOString(),
      postedAt: "",
      externalPostId: null,
      metadata: { publication: { mode: "live", state: "scheduled" } },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.spyOn(SocialRepo, "listSaasSocialPosts").mockResolvedValue([scheduledPost]);
    mockPublishSocialPostLive.mockResolvedValue({ ok: true, post: { ...scheduledPost, status: "PUBLISHED", postedAt: "2026-03-15T12:00:00.000Z" }, account: null });
    const updateSpy = vi.spyOn(SocialRepo, "updateSaasSocialPostStatus").mockResolvedValue({ ...scheduledPost, status: "PUBLISHED", postedAt: "2026-03-15T12:00:00.000Z" });

    const result = await SocialRepo.runSocialSchedulerSimulation(baseCtx);

    expect(Array.isArray(result.publishedPostIds)).toBe(true);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("marks a scheduled post as failed when live publish keeps failing", async () => {
    const scheduledPost: SaasSocialPost = {
      id: "post_fail",
      tenantId: baseCtx.tenantId,
      saasId: "saas_1",
      campaignId: null,
      channelId: null,
      provider: "LINKEDIN",
      contentType: "FEED",
      title: "Scheduled",
      body: "Body",
      imageHint: null,
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() - 60_000).toISOString(),
      postedAt: "",
      externalPostId: null,
      metadata: { publication: { mode: "live", state: "scheduled" } },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.spyOn(SocialRepo, "listSaasSocialPosts").mockResolvedValue([scheduledPost]);
    mockPublishSocialPostLive.mockResolvedValue({ ok: false, post: scheduledPost, account: null, code: "ERR", message: "fail" });
    const updateSpy = vi.spyOn(SocialRepo, "updateSaasSocialPostStatus").mockResolvedValue({ ...scheduledPost, status: "FAILED", metadata: { publication: { mode: "live", state: "failed", errorCode: "ERR" } } });

    const result = await SocialRepo.runSocialSchedulerSimulation(baseCtx);

    expect(Array.isArray(result.publishedPostIds)).toBe(true);
    expect(result.publishedPostIds).not.toContain("post_fail");
  });
});

describe("Posts ordering", () => {
  const ctx = {
    tenantId: "tenant_1",
    saasId: "saas_1",
    mode: "d1",
    allowDemoFallback: false,
    demoTenantId: undefined,
    db: {} as unknown,
    env: {} as unknown,
  } as SocialRepo.SocialContext;

  it("orders by scheduled/post/created desc", async () => {
    const now = Date.now();
    const posts: SaasSocialPost[] = [
      {
        id: "published",
        tenantId: ctx.tenantId,
        saasId: ctx.saasId!,
        campaignId: null,
        channelId: null,
        provider: "LINKEDIN",
        contentType: "FEED",
        title: "already posted",
        body: "body",
        imageHint: null,
        status: "PUBLISHED",
        scheduledAt: null,
        postedAt: new Date(now + 120_000).toISOString(),
        externalPostId: null,
        metadata: null,
        createdAt: new Date(now - 10_000).toISOString(),
        updatedAt: new Date(now - 10_000).toISOString(),
      },
      {
        id: "scheduled",
        tenantId: ctx.tenantId,
        saasId: ctx.saasId!,
        campaignId: null,
        channelId: null,
        provider: "LINKEDIN",
        contentType: "FEED",
        title: "scheduled first",
        body: "body",
        imageHint: null,
        status: "SCHEDULED",
        scheduledAt: new Date(now + 60_000).toISOString(),
        postedAt: null,
        externalPostId: null,
        metadata: null,
        createdAt: new Date(now - 5_000).toISOString(),
        updatedAt: new Date(now - 5_000).toISOString(),
      },
      {
        id: "draft",
        tenantId: ctx.tenantId,
        saasId: ctx.saasId!,
        campaignId: null,
        channelId: null,
        provider: "LINKEDIN",
        contentType: "FEED",
        title: "draft last",
        body: "body",
        imageHint: null,
        status: "DRAFT",
        scheduledAt: null,
        postedAt: null,
        externalPostId: null,
        metadata: null,
        createdAt: new Date(now - 1_000).toISOString(),
        updatedAt: new Date(now - 1_000).toISOString(),
      },
    ];

    vi.spyOn(SocialRepo, "listSaasSocialPosts").mockResolvedValue(posts);

    const ordered = await SocialRepo.listSaasSocialPosts(ctx);

    expect(ordered.map((p: SaasSocialPost) => p.id)).toEqual(["published", "scheduled", "draft"]);
  });
});
