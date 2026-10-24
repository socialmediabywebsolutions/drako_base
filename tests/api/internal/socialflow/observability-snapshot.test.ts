import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GET } from "@/app/api/internal/socialflow/observability/snapshot/route";

describe("GET /api/internal/socialflow/observability/snapshot", () => {
  beforeEach(() => {
    process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN_TEST = "test-service-token";
    delete process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_API_SERVICE_TOKEN;
  });

  function buildRequest(headers?: HeadersInit) {
    return new Request("https://drako.systems/api/internal/socialflow/observability/snapshot", {
      method: "GET",
      headers,
    });
  }

  it("returns 200 with valid headers", async () => {
    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-observability-200",
      "X-Drako-Tenant-Id": "tenant-1",
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      service: string;
      runtime: string;
      timestamp: string;
      requestId: string;
      tenantId: string | null;
      status: string;
      metrics: {
        activeAutomations: number;
        queuedJobs: number;
        failedJobsLast24h: number;
        successfulJobsLast24h: number;
        averageLatencyMs: number | null;
      };
      recentErrors: Array<{ code: string; message: string; occurredAt: string }>;
      warnings: string[];
    };

    expect(payload.service).toBe("socialflow");
    expect(payload.runtime).toBe("monolith");
    expect(typeof payload.timestamp).toBe("string");
    expect(payload.requestId).toBe("req-observability-200");
    expect(payload.tenantId).toBe("tenant-1");
    expect(payload.status).toBe("ok");
    expect(payload.metrics.activeAutomations).toBe(0);
    expect(payload.metrics.queuedJobs).toBe(0);
    expect(payload.metrics.failedJobsLast24h).toBe(0);
    expect(payload.metrics.successfulJobsLast24h).toBe(0);
    expect(payload.metrics.averageLatencyMs).toBeNull();
    expect(payload.recentErrors).toEqual([]);
    expect(Array.isArray(payload.warnings)).toBe(true);
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

  it("returns response shape compatible with SocialFlowObservabilitySnapshot", async () => {
    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-shape",
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;

    expect(payload).toHaveProperty("service", "socialflow");
    expect(payload).toHaveProperty("runtime", "monolith");
    expect(payload).toHaveProperty("timestamp");
    expect(payload).toHaveProperty("requestId", "req-shape");
    expect(payload).toHaveProperty("tenantId", null);
    expect(payload).toHaveProperty("status");
    expect(payload).toHaveProperty("metrics");
    expect(payload).toHaveProperty("recentErrors");
    expect(payload).toHaveProperty("warnings");

    const metrics = payload.metrics as Record<string, unknown>;
    expect(metrics).toHaveProperty("activeAutomations");
    expect(metrics).toHaveProperty("queuedJobs");
    expect(metrics).toHaveProperty("failedJobsLast24h");
    expect(metrics).toHaveProperty("successfulJobsLast24h");
    expect(metrics).toHaveProperty("averageLatencyMs");
  });

  it("does not import forbidden contracts and protected files remain unchanged", () => {
    const routeSource = readFileSync(
      "apps/socialcors/src/app/api/internal/socialflow/observability/snapshot/route.ts",
      "utf8",
    );

    expect(routeSource).not.toContain("@/lib/socialflow/contracts/campobase");
    expect(routeSource).not.toContain("@/lib/socialflow/contracts/owner-dashboard");
    expect(routeSource).not.toContain("@/lib/campobase/socialflow-service");

    const campobaseSource = readFileSync(
      "src/lib/campamento-base/socialflow-control-plane-service.ts",
      "utf8",
    );
    expect(campobaseSource).toContain("@/lib/capabilities/internal-api-clients/socialflow-control-plane");

    const ownerControlDashboardSource = readFileSync(
      "src/lib/owner/control-dashboard.ts",
      "utf8",
    );
    expect(ownerControlDashboardSource).toContain("@/lib/capabilities/internal-api-clients/socialflow-owner");
    expect(ownerControlDashboardSource).not.toContain("@/lib/socialflow/contracts/owner-dashboard");
  });
});
