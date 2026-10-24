import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cf", () => ({ env }));

import { resolvePublishSchedulerOwner } from "@/lib/socialflow/publish-scheduler-owner";
import { claimCronTurn } from "@/lib/security/cron-turn";

describe("resolvePublishSchedulerOwner", () => {
  it("defaults to both (previous behavior) when the var is missing or invalid", () => {
    env.mockReturnValue({});
    expect(resolvePublishSchedulerOwner()).toBe("both");
    expect(resolvePublishSchedulerOwner({ SOCIALFLOW_PUBLISH_SCHEDULER_OWNER: "everyone" } as never)).toBe("both");
  });

  it("accepts ai, web and both regardless of case and whitespace", () => {
    expect(resolvePublishSchedulerOwner({ SOCIALFLOW_PUBLISH_SCHEDULER_OWNER: " AI " } as never)).toBe("ai");
    expect(resolvePublishSchedulerOwner({ SOCIALFLOW_PUBLISH_SCHEDULER_OWNER: "web" } as never)).toBe("web");
    expect(resolvePublishSchedulerOwner({ SOCIALFLOW_PUBLISH_SCHEDULER_OWNER: "both" } as never)).toBe("both");
  });

  it("reads the runtime env when no override is given", () => {
    env.mockReturnValue({ SOCIALFLOW_PUBLISH_SCHEDULER_OWNER: "ai" });
    expect(resolvePublishSchedulerOwner()).toBe("ai");
  });
});

describe("claimCronTurn", () => {
  function fakeDb(insert: () => Promise<unknown>) {
    const run = vi.fn(insert);
    return {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn(() => ({ run: sql.startsWith("INSERT") ? run : vi.fn(async () => ({})) })),
      })),
    } as unknown as D1Database;
  }

  it("claims the turn when the insert succeeds", async () => {
    const result = await claimCronTurn(fakeDb(async () => ({})), "social-publish-ai", 1);
    expect(result.claimed).toBe(true);
    expect(result.turn).toMatch(/:00\.000Z$/);
  });

  it("does not claim when another run already inserted the same turn", async () => {
    const db = fakeDb(async () => {
      throw new Error("D1_ERROR: UNIQUE constraint failed: cron_locks.cron_route, cron_locks.turn");
    });
    expect((await claimCronTurn(db, "social-publish-ai", 1)).claimed).toBe(false);
  });

  it("fails open on any other D1 error so publishing never stops", async () => {
    const db = fakeDb(async () => {
      throw new Error("D1_ERROR: no such table: cron_locks");
    });
    expect((await claimCronTurn(db, "social-publish-ai", 1)).claimed).toBe(true);
  });
});
