import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { POST } from "@/app/api/internal/socialflow/events/route";

describe("POST /api/internal/socialflow/events", () => {
  beforeEach(() => {
    process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN_TEST = "test-service-token";
    delete process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_API_SERVICE_TOKEN;
  });

  function buildValidBody() {
    return {
      eventType: "socialflow.automation.requested",
      source: "campobase",
      occurredAt: "2026-06-06T07:00:00.000Z",
      tenantId: null,
      correlationId: "corr-1",
      payload: {
        automationKey: "socialflow.content_generation",
      },
    };
  }

  function buildRequest(body?: unknown, headers?: HeadersInit) {
    return new Request("https://drako.systems/api/internal/socialflow/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(headers ?? {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  it("returns 202 with valid headers and valid body", async () => {
    const response = await POST(buildRequest(buildValidBody(), {
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-events-202",
      "Idempotency-Key": "idem-1",
    }));

    expect(response.status).toBe(202);
    const payload = await response.json() as {
      service: string;
      runtime: string;
      accepted: boolean;
      eventId: string;
      eventType: string;
      requestId: string;
      tenantId: string | null;
      timestamp: string;
    };

    expect(payload.service).toBe("socialflow");
    expect(payload.runtime).toBe("monolith");
    expect(payload.accepted).toBe(true);
    expect(typeof payload.eventId).toBe("string");
    expect(payload.eventType).toBe("socialflow.automation.requested");
    expect(payload.requestId).toBe("req-events-202");
    expect(payload.tenantId).toBeNull();
    expect(typeof payload.timestamp).toBe("string");
  });

  it("returns 401 without Authorization", async () => {
    const response = await POST(buildRequest(buildValidBody(), {
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-no-auth",
    }));

    expect(response.status).toBe(401);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_UNAUTHORIZED");
  });

  it("returns 403 with invalid token", async () => {
    const response = await POST(buildRequest(buildValidBody(), {
      Authorization: "Bearer wrong-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-bad-token",
    }));

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_FORBIDDEN");
  });

  it("returns 403 with invalid control plane", async () => {
    const response = await POST(buildRequest(buildValidBody(), {
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "owner",
      "X-Drako-Request-Id": "req-bad-control-plane",
    }));

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_FORBIDDEN");
  });

  it("returns 400 without request id", async () => {
    const response = await POST(buildRequest(buildValidBody(), {
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
    }));

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_BAD_REQUEST");
  });

  it("returns 400 with invalid JSON body", async () => {
    const request = new Request("https://drako.systems/api/internal/socialflow/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-service-token",
        "X-Drako-Control-Plane": "campobase",
        "X-Drako-Request-Id": "req-invalid-json",
      },
      body: "{invalid-json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_BAD_REQUEST");
  });

  it("returns 400 with non-allowed eventType", async () => {
    const response = await POST(buildRequest({
      ...buildValidBody(),
      eventType: "socialflow.unknown.event",
    }, {
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-invalid-event-type",
    }));

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_BAD_REQUEST");
  });

  it("returns response shape compatible with SocialFlowEventResponse", async () => {
    const response = await POST(buildRequest({
      ...buildValidBody(),
      tenantId: "tenant-from-body",
    }, {
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-shape",
      "X-Drako-Tenant-Id": "tenant-from-header",
    }));

    expect(response.status).toBe(202);
    const payload = await response.json() as Record<string, unknown>;

    expect(payload).toHaveProperty("service", "socialflow");
    expect(payload).toHaveProperty("runtime", "monolith");
    expect(payload).toHaveProperty("accepted", true);
    expect(payload).toHaveProperty("eventId");
    expect(payload).toHaveProperty("eventType", "socialflow.automation.requested");
    expect(payload).toHaveProperty("requestId", "req-shape");
    expect(payload).toHaveProperty("tenantId", "tenant-from-body");
    expect(payload).toHaveProperty("timestamp");
  });

  it("does not import forbidden modules and protected files remain unchanged", () => {
    const routeSource = readFileSync(
      "apps/socialcors/src/app/api/internal/socialflow/events/route.ts",
      "utf8",
    );

    expect(routeSource).not.toContain("@/lib/socialflow/contracts/campobase");
    expect(routeSource).not.toContain("@/lib/socialflow/contracts/owner-dashboard");
    expect(routeSource).not.toContain("@/lib/campobase/socialflow-service");
    expect(routeSource).not.toContain("@/lib/owner/control-dashboard");

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
