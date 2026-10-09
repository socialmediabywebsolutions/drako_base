import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyCronAuth = vi.hoisted(() => vi.fn());
const processScheduledPosts = vi.hoisted(() => vi.fn());
const guardCronTurn = vi.hoisted(() => vi.fn());
const resolvePublishSchedulerOwner = vi.hoisted(() => vi.fn());
const CronAuthError = vi.hoisted(() => class CronAuthError extends Error {
  status: number;

  constructor(message = "Unauthorized", status = 401) {
    super(message);
    this.status = status;
  }
});

vi.mock("@/lib/socialflow/platform/cron/auth", () => ({
  CronAuthError,
  verifyCronAuth,
}));

vi.mock("@/lib/socialflow/scheduler", () => ({
  processScheduledPosts,
}));

vi.mock("@/lib/socialflow/platform/cron/lock", () => ({
  guardCronTurn,
}));

vi.mock("@/lib/socialflow/publish-scheduler-owner", () => ({
  resolvePublishSchedulerOwner,
  WEB_FALLBACK_MIN_OVERDUE_MINUTES: 10,
}));

function cronRequest(query = "") {
  return new NextRequest(`https://drako.local/api/cron/social/publish${query}`);
}

import { GET } from "@/app/api/cron/social/publish/route";

describe("/api/cron/social/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyCronAuth.mockReturnValue(undefined);
    guardCronTurn.mockResolvedValue(null);
    resolvePublishSchedulerOwner.mockReturnValue("both");
    processScheduledPosts.mockResolvedValue({ results: [], recovered: 0 });
  });

  it("publishes every due post when the web worker owns publishing", async () => {
    resolvePublishSchedulerOwner.mockReturnValue("web");

    const response = await GET(cronRequest());

    expect(processScheduledPosts).toHaveBeenCalledWith({});
    expect(await response.json()).toMatchObject({ success: true, owner: "web", mode: "all_due" });
  });

  it("only picks up posts overdue by 10+ minutes when the AI worker owns publishing", async () => {
    resolvePublishSchedulerOwner.mockReturnValue("ai");

    const response = await GET(cronRequest());

    expect(processScheduledPosts).toHaveBeenCalledWith({ minOverdueMinutes: 10 });
    expect(await response.json()).toMatchObject({ success: true, owner: "ai", mode: "fallback_overdue_only" });
  });

  it("processes everything with ?force=1 even when the AI worker owns publishing", async () => {
    resolvePublishSchedulerOwner.mockReturnValue("ai");

    await GET(cronRequest("?force=1"));

    expect(processScheduledPosts).toHaveBeenCalledWith({});
  });

  it("does nothing when another run already holds the turn", async () => {
    guardCronTurn.mockResolvedValue(Response.json({ ok: true, skipped: "ALREADY_RAN_THIS_TURN" }));

    const response = await GET(cronRequest());

    expect(processScheduledPosts).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ skipped: "ALREADY_RAN_THIS_TURN" });
  });

  it("returns explicit JSON when SOCIAL_DB is unavailable in local runtime", async () => {
    processScheduledPosts.mockRejectedValue(new Error("SOCIAL_DB not configured"));

    const response = await GET(cronRequest());
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

    const response = await GET(cronRequest());
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      success: false,
      code: "SOCIAL_CRON_PUBLISH_FAILED",
      message: "boom",
    });
  });
});
