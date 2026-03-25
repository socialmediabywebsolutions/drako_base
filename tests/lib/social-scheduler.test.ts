import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => vi.fn());
const resolveSocialContext = vi.hoisted(() => vi.fn());
const publishSocialPostLive = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cf", () => ({
  env,
}));

vi.mock("@/lib/social/repository", () => ({
  resolveSocialContext,
}));

vi.mock("@/lib/social/live-publishing", () => ({
  publishSocialPostLive,
}));

import { processScheduledPosts } from "@/lib/social/scheduler";

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
    publishSocialPostLive.mockResolvedValue({ ok: true, message: "Published" });
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
    expect(results).toEqual([
      expect.objectContaining({
        id: "post-1",
        status: "PUBLISHED",
      }),
    ]);
  });
});
