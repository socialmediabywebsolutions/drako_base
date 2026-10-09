import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { GET } from "@/app/api/internal/socialflow/health/route";

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

describe("GET /api/internal/socialflow/health", () => {
  beforeEach(() => {
    process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN_TEST = "test-service-token";
    delete process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_API_SERVICE_TOKEN;
    env.mockReturnValue({
      SOCIAL_DB: fakeSocialDb({ lastTurn: new Date().toISOString() }).db,
      SOCIALFLOW_AUTHS_DB: {},
      SOCIAL_MEDIA_BUCKET: {},
      SOCIALFLOW_AI_QUEUE: {},
      SOCIALFLOW_PUBLISH_SCHEDULER_OWNER: "ai",
    });
  });

  function buildRequest(headers?: HeadersInit) {
    return new Request("https://drako.systems/api/internal/socialflow/health", {
      method: "GET",
      headers,
    });
  }

  it("returns 200 with valid headers", async () => {
    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-health-200",
      "X-Drako-Tenant-Id": "tenant-1",
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      service: string;
      status: string;
      runtime: string;
      version: string;
      timestamp: string;
      requestId: string;
      checks: Record<string, { status: string; detail: string }>;
    };

    expect(payload.service).toBe("socialflow");
    expect(payload.status).toBe("ok");
    expect(payload.runtime).toBe("socialcors");
    expect(typeof payload.version).toBe("string");
    expect(typeof payload.timestamp).toBe("string");
    expect(payload.requestId).toBe("req-health-200");
    expect(payload.checks.contract.status).toBe("ok");
    expect(payload.checks.runtime.status).toBe("ok");
    expect(payload.checks.auth.status).toBe("ok");
    expect(payload.checks.database.status).toBe("ok");
    expect(payload.checks.scheduler.status).toBe("ok");
    expect(response.headers.get("X-SocialCors-Contract-Version")).toBe("2026-10-09");
  });

  it("reports degraded when the publish cron has not claimed a turn recently", async () => {
    env.mockReturnValue({
      SOCIAL_DB: fakeSocialDb({ lastTurn: new Date(Date.now() - 30 * 60_000).toISOString() }).db,
      SOCIALFLOW_AUTHS_DB: {},
      SOCIAL_MEDIA_BUCKET: {},
      SOCIALFLOW_AI_QUEUE: {},
      SOCIALFLOW_PUBLISH_SCHEDULER_OWNER: "ai",
    });

    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-health-stale",
    }));
    const payload = await response.json() as { status: string; checks: Record<string, { status: string; detail: string }> };

    expect(response.status).toBe(200);
    expect(payload.status).toBe("degraded");
    expect(payload.checks.scheduler.status).toBe("degraded");
    expect(payload.checks.scheduler.detail).toContain("social-publish-ai");
  });

  it("reports down (503) when SOCIAL_DB is not reachable", async () => {
    env.mockReturnValue({ SOCIAL_DB: fakeSocialDb({ fail: true }).db, SOCIALFLOW_AUTHS_DB: {}, SOCIAL_MEDIA_BUCKET: {}, SOCIALFLOW_AI_QUEUE: {} });

    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-health-down",
    }));
    const payload = await response.json() as { status: string; checks: Record<string, { status: string }> };

    expect(response.status).toBe(503);
    expect(payload.status).toBe("down");
    expect(payload.checks.database.status).toBe("down");
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

  it("returns response shape compatible with contract", async () => {
    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-shape",
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;

    expect(payload).toHaveProperty("service", "socialflow");
    expect(payload).toHaveProperty("runtime", "socialcors");
    expect(payload).toHaveProperty("version");
    expect(payload).toHaveProperty("timestamp");
    expect(payload).toHaveProperty("requestId", "req-shape");
    expect(payload).toHaveProperty("checks");

    const checks = payload.checks as Record<string, unknown>;
    expect(checks).toHaveProperty("contract");
    expect(checks).toHaveProperty("runtime");
    expect(checks).toHaveProperty("auth");
  });

  it("does not import campobase service from this endpoint", async () => {
    const routeSource = readFileSync(
      "apps/socialcors/src/app/api/internal/socialflow/health/route.ts",
      "utf8",
    );

    expect(routeSource).not.toContain("@/lib/campobase/socialflow-service");
  });
});
