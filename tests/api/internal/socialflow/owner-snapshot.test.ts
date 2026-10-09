import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { GET } from "@/app/api/internal/socialflow/owner/snapshot/route";

const env = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cf", () => ({ env }));

// D1 falso: responde según la consulta (SELECT 1, cron_locks, conteos de SOCIAL_DB).
function fakeSocialDb(answers: { lastTurn?: string | null; counts?: Record<string, number>; lastRun?: string | null; fail?: boolean } = {}) {
  const calls: Array<{ sql: string; binds: unknown[] }> = [];
  const first = async (sql: string) => {
    if (answers.fail) throw new Error("D1 unavailable");
    if (sql.includes("SELECT 1")) return { ok: 1 };
    if (sql.includes("cron_locks")) return { last_turn: answers.lastTurn ?? null };
    if (sql.includes("MAX(posted_at)")) return { last_run: answers.lastRun ?? null };
    const key = Object.keys(answers.counts ?? {}).find((fragment) => sql.includes(fragment));
    return { n: key ? answers.counts![key] : 0 };
  };
  const db = {
    prepare: (sql: string) => {
      const statement = {
        bind: (...binds: unknown[]) => {
          calls.push({ sql, binds });
          return { first: () => first(sql) };
        },
        first: () => {
          calls.push({ sql, binds: [] });
          return first(sql);
        },
      };
      return statement;
    },
  };
  return { db: db as unknown as D1Database, calls };
}

describe("GET /api/internal/socialflow/owner/snapshot", () => {
  beforeEach(() => {
    process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN_TEST = "test-service-token";
    delete process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_API_SERVICE_TOKEN;
    env.mockReturnValue({ SOCIAL_DB: fakeSocialDb().db });
  });

  function buildRequest(headers?: HeadersInit) {
    return new Request("https://drako.systems/api/internal/socialflow/owner/snapshot", {
      method: "GET",
      headers,
    });
  }

  it("returns 200 with valid headers", async () => {
    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-owner-snapshot-200",
      "X-Drako-Tenant-Id": "tenant-1",
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      service: string;
      runtime: string;
      timestamp: string;
      requestId: string;
      tenantId: string | null;
      snapshot: {
        status: string;
        activeCampaigns: number;
        scheduledPosts: number;
        failedPostsLast24h: number;
        connectedProfiles: number;
        lastRunAt: string | null;
      };
      warnings: string[];
    };

    expect(payload.service).toBe("socialflow");
    expect(payload.runtime).toBe("socialcors");
    expect(typeof payload.timestamp).toBe("string");
    expect(payload.requestId).toBe("req-owner-snapshot-200");
    expect(payload.tenantId).toBe("tenant-1");
    expect(payload.snapshot.status).toBe("ok");
    expect(payload.snapshot.activeCampaigns).toBe(0);
    expect(payload.snapshot.scheduledPosts).toBe(0);
    expect(payload.snapshot.failedPostsLast24h).toBe(0);
    expect(payload.snapshot.connectedProfiles).toBe(0);
    expect(payload.snapshot.lastRunAt).toBeNull();
    expect(Array.isArray(payload.warnings)).toBe(true);
  });

  it("computes real counts from SOCIAL_DB scoped to the requested tenant", async () => {
    const { db, calls } = fakeSocialDb({
      counts: {
        "saas_social_campaigns WHERE status = 'ACTIVE'": 3,
        "status = 'SCHEDULED'": 7,
        "status = 'FAILED'": 2,
        "saas_social_accounts WHERE status = 'CONNECTED_REAL'": 1,
      },
      lastRun: "2026-10-09T08:00:00.000Z",
    });
    env.mockReturnValue({ SOCIAL_DB: db });

    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-owner-real",
      "X-Drako-Tenant-Id": "tenant-9",
    }));
    const payload = await response.json() as { snapshot: Record<string, unknown>; warnings: string[] };

    expect(payload.snapshot).toEqual({
      status: "degraded",
      activeCampaigns: 3,
      scheduledPosts: 7,
      failedPostsLast24h: 2,
      connectedProfiles: 1,
      lastRunAt: "2026-10-09T08:00:00.000Z",
    });
    expect(payload.warnings).toEqual([]);
    expect(calls.every((call) => call.sql.includes("tenant_id = ?") && call.binds.includes("tenant-9"))).toBe(true);
  });

  it("returns 503 when SOCIAL_DB is not bound", async () => {
    env.mockReturnValue({});
    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-owner-no-db",
    }));
    expect(response.status).toBe(503);
  });

  it("returns 401 without Authorization", async () => {
    const response = await GET(buildRequest({
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-no-auth",
    }));

    expect(response.status).toBe(401);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_UNAUTHORIZED");
  });

  it("returns 403 with invalid token", async () => {
    const response = await GET(buildRequest({
      Authorization: "Bearer wrong-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-bad-token",
    }));

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_FORBIDDEN");
  });

  it("returns 403 with invalid control plane", async () => {
    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "owner",
      "X-Drako-Request-Id": "req-bad-control-plane",
    }));

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_FORBIDDEN");
  });

  it("returns 400 without request id", async () => {
    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
    }));

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_BAD_REQUEST");
  });

  it("returns response shape compatible with SocialFlowOwnerSnapshotResponse", async () => {
    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-shape",
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;

    expect(payload).toHaveProperty("service", "socialflow");
    expect(payload).toHaveProperty("runtime", "socialcors");
    expect(payload).toHaveProperty("timestamp");
    expect(payload).toHaveProperty("requestId", "req-shape");
    expect(payload).toHaveProperty("tenantId", null);
    expect(payload).toHaveProperty("snapshot");
    expect(payload).toHaveProperty("warnings");

    const snapshot = payload.snapshot as Record<string, unknown>;
    expect(snapshot).toHaveProperty("status");
    expect(snapshot).toHaveProperty("activeCampaigns");
    expect(snapshot).toHaveProperty("scheduledPosts");
    expect(snapshot).toHaveProperty("failedPostsLast24h");
    expect(snapshot).toHaveProperty("connectedProfiles");
    expect(snapshot).toHaveProperty("lastRunAt");
  });

  it("does not import socialflow owner-dashboard contract and owner file now uses internal client", () => {
    const routeSource = readFileSync(
      "apps/socialcors/src/app/api/internal/socialflow/owner/snapshot/route.ts",
      "utf8",
    );
    expect(routeSource).not.toContain("@/lib/socialflow/contracts/owner-dashboard");

    const ownerControlDashboardSource = readFileSync(
      "src/lib/owner/control-dashboard.ts",
      "utf8",
    );
    expect(ownerControlDashboardSource).not.toContain("@/lib/socialflow/contracts/owner-dashboard");
    expect(ownerControlDashboardSource).toContain("@/lib/capabilities/internal-api-clients/socialflow-owner");
  });
});
