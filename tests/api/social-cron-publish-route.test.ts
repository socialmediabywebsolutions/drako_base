import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyCronAuth = vi.hoisted(() => vi.fn());
const processScheduledPosts = vi.hoisted(() => vi.fn());
const CronAuthError = vi.hoisted(() => class CronAuthError extends Error {
  status: number;

  constructor(message = "Unauthorized", status = 401) {
    super(message);
    this.status = status;
  }
});

vi.mock("@/lib/security/cron-auth", () => ({
  CronAuthError,
  verifyCronAuth,
}));

vi.mock("@/lib/social/scheduler", () => ({
  processScheduledPosts,
}));

import { GET } from "@/app/api/cron/social/publish/route";

describe("/api/cron/social/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyCronAuth.mockReturnValue(undefined);
  });

  it("returns explicit JSON when SOCIAL_DB is unavailable in local runtime", async () => {
    processScheduledPosts.mockRejectedValue(new Error("SOCIAL_DB not configured"));

    const response = await GET(new Request("https://drako.local/api/cron/social/publish") as any);
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      success: false,
      code: "SOCIAL_DB_UNAVAILABLE",
      message: "SOCIAL_DB is not configured in the current local runtime.",
      details: expect.objectContaining({
        binding: "SOCIAL_DB",
      }),
    });
  });

  it("returns scheduler failures as explicit JSON", async () => {
    processScheduledPosts.mockRejectedValue(new Error("boom"));

    const response = await GET(new Request("https://drako.local/api/cron/social/publish") as any);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      success: false,
      code: "SOCIAL_CRON_PUBLISH_FAILED",
      message: "boom",
    });
  });
});
