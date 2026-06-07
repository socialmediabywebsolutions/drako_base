import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GET } from "@/app/api/internal/socialflow/health/route";

describe("GET /api/internal/socialflow/health", () => {
  beforeEach(() => {
    process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN_TEST = "test-service-token";
    delete process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_API_SERVICE_TOKEN;
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
    expect(payload.runtime).toBe("monolith");
    expect(typeof payload.version).toBe("string");
    expect(typeof payload.timestamp).toBe("string");
    expect(payload.requestId).toBe("req-health-200");
    expect(payload.checks.contract.status).toBe("ok");
    expect(payload.checks.runtime.status).toBe("ok");
    expect(payload.checks.auth.status).toBe("ok");
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
    expect(payload).toHaveProperty("runtime", "monolith");
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
      "src/app/api/internal/socialflow/health/route.ts",
      "utf8",
    );

    expect(routeSource).not.toContain("@/lib/campobase/socialflow-service");
  });
});
