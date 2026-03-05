import { beforeEach, describe, expect, it, vi } from "vitest";
import { type AiRunPayload, handleAiRunRequest } from "../api/ai";
import type { AutopilotEnv } from "../index";

type FirstResolver = (sql: string, params: unknown[]) => unknown;

const VALID_CORRELATION_ID = "75922063-2f32-49a1-a662-7c11da494e61";

function createDbMock(firstResolver: FirstResolver) {
  let lastSql = "";
  let lastParams: unknown[] = [];
  const db: any = {
    prepare: vi.fn((sql: string) => {
      lastSql = sql;
      lastParams = [];
      return db;
    }),
    bind: vi.fn((...params: unknown[]) => {
      lastParams = params;
      return db;
    }),
    all: vi.fn().mockResolvedValue([]),
    first: vi.fn(async () => firstResolver(lastSql, lastParams)),
    run: vi.fn().mockResolvedValue({}),
    batch: vi.fn().mockResolvedValue([]),
  };
  return db;
}

describe("AI Router v1.1 - Steel Governance", () => {
  let ai: any;

  beforeEach(() => {
    ai = {
      run: vi.fn().mockResolvedValue({ response: "AI Response", usage: { total_tokens: 10 } }),
    };
  });

  const mockPayload: AiRunPayload = {
    messages: [{ role: "user", content: "Hello" }],
    taskType: "marketing_copy",
    mode: "smart",
  };

  function buildEnv(firstResolver: FirstResolver): AutopilotEnv {
    return {
      DRACO_DB: createDbMock(firstResolver),
      AI: ai,
      VERCEL_TO_WORKER_SECRET: "proxy-secret",
      X_DRAKO_ORIGIN_SECRET: "origin-secret",
    } as unknown as AutopilotEnv;
  }

  it("should reject unauthorized requests (missing secret)", async () => {
    const env = buildEnv(() => null);
    const req = new Request("https://worker/internal/ai/run", {
      method: "POST",
      body: JSON.stringify(mockPayload),
      headers: {
        Authorization: "Bearer wrong",
        "X-Drako-Origin-Secret": "origin-secret",
      },
    });
    const res = await handleAiRunRequest(req, env);
    expect(res.status).toBe(401);
  });

  it("should resolve policy and execute successfully", async () => {
    const env = buildEnv((sql) => {
      if (sql.includes("ai_rate_limit_buckets")) return { count: 1 };
      if (sql.includes("FROM ai_cost_policies")) return null;
      if (sql.includes("FROM ai_provider_policies")) {
        return { provider: "cloudflare", model: "@cf/meta/llama-3.1-70b-instruct" };
      }
      if (sql.includes("FROM ai_circuit_breakers")) {
        return { state: "CLOSED", opened_at: null, cooldown_until: null };
      }
      return null;
    });

    const req = new Request("https://worker/internal/ai/run", {
      method: "POST",
      body: JSON.stringify(mockPayload),
      headers: {
        Authorization: "Bearer proxy-secret",
        "X-Drako-Origin-Secret": "origin-secret",
        "X-Drako-Correlation-Id": VALID_CORRELATION_ID,
      },
    });

    const res = await handleAiRunRequest(req, env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.ok).toBe(true);
    expect(data.content).toBe("AI Response");
    expect(data.correlationId).toBe(VALID_CORRELATION_ID);
    expect(data.provider).toBe("cloudflare");
    expect(data.model).toMatch(/^@cf\//);
  });

  it("should return 402 when hard limit is exceeded", async () => {
    const env = buildEnv((sql) => {
      if (sql.includes("ai_rate_limit_buckets")) return { count: 1 };
      if (sql.includes("FROM ai_cost_policies")) {
        return { current_cost_usd: 100, hard_limit_usd: 100 };
      }
      return null;
    });

    const req = new Request("https://worker/internal/ai/run", {
      method: "POST",
      body: JSON.stringify(mockPayload),
      headers: {
        Authorization: "Bearer proxy-secret",
        "X-Drako-Origin-Secret": "origin-secret",
        "X-Drako-Tenant-Id": "tenant_a",
      },
    });

    const res = await handleAiRunRequest(req, env);
    expect(res.status).toBe(402);
    const data = (await res.json()) as any;
    expect(data.code).toBe("COST_HARD_LIMIT");
  });

  it("should return 429 when rate limited", async () => {
    const env = buildEnv((sql) => {
      if (sql.includes("ai_rate_limit_buckets")) return { count: 100 };
      return null;
    });

    const req = new Request("https://worker/internal/ai/run", {
      method: "POST",
      body: JSON.stringify(mockPayload),
      headers: {
        Authorization: "Bearer proxy-secret",
        "X-Drako-Origin-Secret": "origin-secret",
      },
    });

    const res = await handleAiRunRequest(req, env);
    expect(res.status).toBe(429);
  });

  it("should fallback to Cloudflare when circuit is OPEN for external provider", async () => {
    const env = buildEnv((sql, params) => {
      if (sql.includes("ai_rate_limit_buckets")) return { count: 1 };
      if (sql.includes("FROM ai_cost_policies")) return null;
      if (sql.includes("FROM ai_provider_policies")) {
        return params[0] === "system"
          ? { provider: "cloudflare", model: "@cf/meta/llama-3-8b-instruct" }
          : { provider: "openai", model: "gpt-4" };
      }
      if (sql.includes("FROM ai_circuit_breakers")) {
        return params[0] === "ai:openai:gpt-4"
          ? { state: "OPEN", opened_at: new Date().toISOString(), cooldown_until: null }
          : { state: "CLOSED", opened_at: null, cooldown_until: null };
      }
      return null;
    });

    const req = new Request("https://worker/internal/ai/run", {
      method: "POST",
      body: JSON.stringify(mockPayload),
      headers: {
        Authorization: "Bearer proxy-secret",
        "X-Drako-Origin-Secret": "origin-secret",
      },
    });

    const res = await handleAiRunRequest(req, env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.provider).toBe("cloudflare");
    expect(data.model).toMatch(/^@cf\//);
    expect((env.DRACO_DB as any).bind.mock.calls.some((call: unknown[]) => call[0] === "system")).toBe(true);
  });
});
