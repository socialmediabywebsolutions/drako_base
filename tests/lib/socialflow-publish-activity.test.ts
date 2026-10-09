import { describe, expect, it, vi } from "vitest";
import { listPublishActivities, recordPublishActivity } from "@/lib/socialflow/publish-activity";

function fakeDb(rows: unknown[] = []) {
  const run = vi.fn(async () => ({}));
  const all = vi.fn(async () => ({ results: rows }));
  const bind = vi.fn(() => ({ run, all }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare } as unknown as D1Database, prepare, bind };
}

describe("publish activity (SOCIAL_DB)", () => {
  it("inserts one row per event into socialflow_publish_activity", async () => {
    const { db, prepare, bind } = fakeDb();

    await recordPublishActivity(db, {
      tenantId: "tenant-a",
      saasId: "socialflow",
      postId: "post-1",
      activityType: "publish_failed",
      status: "error",
      summary: "boom",
      metadata: { errorCode: "INSTAGRAM_PUBLISH_FAILED" },
    });

    expect(prepare.mock.calls[0][0]).toContain("INSERT INTO socialflow_publish_activity");
    const args = bind.mock.calls[0] as unknown[];
    expect(args.slice(1, 7)).toEqual(["tenant-a", "socialflow", "post-1", "publish_failed", "error", "boom"]);
    expect(args[7]).toBe(JSON.stringify({ errorCode: "INSTAGRAM_PUBLISH_FAILED" }));
  });

  it("lists the tenant's activity scoped by tenant and saas", async () => {
    const { db, bind } = fakeDb([
      {
        id: "a1",
        tenant_id: "tenant-a",
        saas_id: "socialflow",
        post_id: "post-1",
        activity_type: "publish_succeeded",
        status: "success",
        summary: "ok",
        metadata: "{\"durationMs\":120}",
        created_at: "2026-10-09T10:00:00.000Z",
      },
    ]);

    const activities = await listPublishActivities(db, { tenantId: "tenant-a", saasId: "socialflow", limit: 5 });

    expect(bind).toHaveBeenCalledWith("tenant-a", "socialflow", 5);
    expect(activities).toEqual([
      expect.objectContaining({ postId: "post-1", activityType: "publish_succeeded", metadata: { durationMs: 120 } }),
    ]);
  });
});
