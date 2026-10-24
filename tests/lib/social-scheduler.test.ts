import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => vi.fn());
const resolveSocialContext = vi.hoisted(() => vi.fn());
const recoverStalePublishingPosts = vi.hoisted(() => vi.fn());
const publishSocialPostLive = vi.hoisted(() => vi.fn());
const isAutoPublishBlockedByPrivatePilotMode = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cf", () => ({
  env,
}));

vi.mock("@/lib/socialflow/repository", () => ({
  resolveSocialContext,
  recoverStalePublishingPosts,
}));

vi.mock("@/lib/socialflow/live-publishing", () => ({
  publishSocialPostLive,
}));

vi.mock("@/lib/socialflow/private-pilot", () => ({
  isAutoPublishBlockedByPrivatePilotMode,
}));

import { processScheduledPosts } from "@/lib/socialflow/scheduler";

describe("processScheduledPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.mockReturnValue({
      SOCIAL_DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            all: vi.fn(async () => ({
              results: [{ id: "post-1", tenant_id: "tenant_socialflow", saas_id: "socialflow" }],
            })),
          })),
        })),
      },
    });
    resolveSocialContext.mockResolvedValue({ tenantId: "tenant_socialflow", saasId: "socialflow", mode: "d1", socialDb: {} });
    recoverStalePublishingPosts.mockResolvedValue(0);
    publishSocialPostLive.mockResolvedValue({ ok: true, code: "PUBLISHED_LIVE_LINKEDIN", message: "Published" });
    isAutoPublishBlockedByPrivatePilotMode.mockReturnValue(false);
  });

  it("publishes due scheduled posts from SOCIAL_DB", async () => {
    const results = await processScheduledPosts();

    expect(resolveSocialContext).toHaveBeenCalledWith({
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
    });
    expect(publishSocialPostLive).toHaveBeenCalledWith(
      expect.objectContaining({ saasId: "socialflow" }),
      "post-1",
    );
    expect(results.recovered).toBe(0);
    expect(results.results).toEqual([
      expect.objectContaining({
        id: "post-1",
        status: "PUBLISHED",
      }),
    ]);
  });

  it("only selects posts overdue by minOverdueMinutes when asked (web fallback mode)", async () => {
    const bind = vi.fn(() => ({ all: vi.fn(async () => ({ results: [] })) }));
    env.mockReturnValue({ SOCIAL_DB: { prepare: vi.fn(() => ({ bind })) } });
    const before = Date.now();

    await processScheduledPosts({ minOverdueMinutes: 10 });

    const cutoff = Date.parse(bind.mock.calls[0][0] as unknown as string);
    expect(cutoff).toBeLessThanOrEqual(before - 10 * 60 * 1000 + 1000);
    expect(cutoff).toBeGreaterThan(before - 11 * 60 * 1000);
    expect(publishSocialPostLive).not.toHaveBeenCalled();
  });

  it("skips auto-publish when private pilot mode blocks scheduler publishing", async () => {
    isAutoPublishBlockedByPrivatePilotMode.mockReturnValue(true);

    const results = await processScheduledPosts();

    expect(publishSocialPostLive).not.toHaveBeenCalled();
    expect(results.results).toEqual([
      expect.objectContaining({
        id: "post-1",
        status: "SKIPPED",
        code: "PRIVATE_PILOT_AUTOPUBLISH_BLOCKED",
      }),
    ]);
  });
});
