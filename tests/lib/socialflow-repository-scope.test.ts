import { describe, expect, it } from "vitest";
import { claimScheduledPostForPublishing, getSaasSocialPostById, type SocialContext } from "@/lib/socialflow/repository";

type RecordedStatement = {
  sql: string;
  params: unknown[];
  mode: "all" | "run";
};

function createFakeSocialDb(recorder: RecordedStatement[]) {
  return {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async all<T>() {
              recorder.push({ sql, params, mode: "all" });
              return { results: [] as T[] };
            },
            async run() {
              recorder.push({ sql, params, mode: "run" });
              return { meta: { changes: 1 } };
            },
          };
        },
        async all<T>() {
          recorder.push({ sql, params: [], mode: "all" });
          return { results: [] as T[] };
        },
        async run() {
          recorder.push({ sql, params: [], mode: "run" });
          return { meta: { changes: 1 } };
        },
      };
    },
  } as unknown as D1Database;
}

function createContext(socialDb: D1Database): SocialContext {
  return {
    tenantId: "tenant-socialflow",
    saasId: "socialflow",
    mode: "d1",
    socialDb,
  };
}

describe("socialflow repository scope hardening", () => {
  it("filters getSaasSocialPostById by tenant_id + saas_id + id", async () => {
    const recorded: RecordedStatement[] = [];
    const ctx = createContext(createFakeSocialDb(recorded));

    await getSaasSocialPostById(ctx, "post-1");

    const query = recorded.find((entry) => entry.mode === "all" && entry.sql.includes("FROM saas_social_posts"));
    expect(query).toBeTruthy();
    expect(query?.sql).toContain("WHERE tenant_id = ? AND saas_id = ? AND id = ?");
    expect(query?.params).toEqual(["tenant-socialflow", "socialflow", "post-1"]);
  });

  it("filters claimScheduledPostForPublishing by tenant_id + saas_id + status", async () => {
    const recorded: RecordedStatement[] = [];
    const ctx = createContext(createFakeSocialDb(recorded));

    const claimed = await claimScheduledPostForPublishing(ctx, "post-2");

    expect(claimed).toBe(true);
    const update = recorded.find((entry) => entry.mode === "run" && entry.sql.includes("UPDATE saas_social_posts"));
    expect(update).toBeTruthy();
    expect(update?.sql).toContain("WHERE id = ? AND tenant_id = ? AND saas_id = ? AND status = 'SCHEDULED'");
    expect(update?.params[1]).toBe("post-2");
    expect(update?.params[2]).toBe("tenant-socialflow");
    expect(update?.params[3]).toBe("socialflow");
  });
});
