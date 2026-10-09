import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
const queueOperatorCampaign = vi.hoisted(() => vi.fn());
const checkTenantConnections = vi.hoisted(() => vi.fn());
vi.mock("@/lib/socialflow/internal-api/operator-actions", () => ({ queueOperatorCampaign, checkTenantConnections }));

import { POST } from "@/app/api/internal/socialflow/automation/trigger/route";

describe("POST /api/internal/socialflow/automation/trigger", () => {
  beforeEach(() => {
    process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN_TEST = "test-service-token";
    delete process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_API_SERVICE_TOKEN;
    queueOperatorCampaign.mockReset().mockResolvedValue({ campaignId: "camp-1" });
    checkTenantConnections.mockReset().mockResolvedValue({ checksPassed: 2, checksFailed: 0, recommendedAction: "All connections are healthy.", accounts: [] });
  });

  function buildValidBody() {
    return {
      automationType: "generate_schedule",
      source: "campobase",
      tenantId: "tenant-1",
      correlationId: "corr-1",
      requestedBy: "campobase-cron",
      payload: {
        saasId: "socialflow",
        niche: "fitness",
        tone: "cercano",
        frequencyPerWeek: 3,
      },
    };
  }

  function buildRequest(body?: unknown, headers?: HeadersInit) {
    return new Request("https://drako.systems/api/internal/socialflow/automation/trigger", {
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
      "X-Drako-Request-Id": "req-automation-202",
      "Idempotency-Key": "idem-1",
    }));

    expect(response.status).toBe(202);
    const payload = await response.json() as {
      service: string;
      runtime: string;
      accepted: boolean;
      automationId: string;
      automationType: string;
      requestId: string;
      tenantId: string | null;
      timestamp: string;
      status: string;
    };

    expect(payload.service).toBe("socialflow");
    expect(payload.runtime).toBe("socialcors");
    expect(payload.accepted).toBe(true);
    expect(payload.automationId).toBe("camp-1");
    expect(payload.automationType).toBe("generate_schedule");
    expect(payload.requestId).toBe("req-automation-202");
    expect(payload.tenantId).toBe("tenant-1");
    expect(typeof payload.timestamp).toBe("string");
    expect(payload.status).toBe("queued");
    expect(queueOperatorCampaign).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      saasId: "socialflow",
      niche: "fitness",
      tone: "cercano",
      frequencyPerWeek: 3,
    });
  });

  it("runs validate_connections for real and returns the check result", async () => {
    const response = await POST(buildRequest({ ...buildValidBody(), automationType: "validate_connections", payload: { saasId: "socialflow" } }, {
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-validate",
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as { status: string; result: { checksPassed: number } };
    expect(payload.status).toBe("completed");
    expect(payload.result.checksPassed).toBe(2);
    expect(checkTenantConnections).toHaveBeenCalledWith({ tenantId: "tenant-1", saasId: "socialflow" });
  });

  it("rejects automations that only SocialCors crons run (422, no fake queued)", async () => {
    const response = await POST(buildRequest({ ...buildValidBody(), automationType: "publish_due_posts" }, {
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-not-supported",
    }));

    expect(response.status).toBe(422);
    expect((await response.json() as { code: string }).code).toBe("INTERNAL_API_NOT_SUPPORTED");
    expect(queueOperatorCampaign).not.toHaveBeenCalled();
  });

  it("requires a niche to generate a schedule", async () => {
    const response = await POST(buildRequest({ ...buildValidBody(), payload: { saasId: "socialflow" } }, {
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-no-niche",
    }));

    expect(response.status).toBe(400);
    expect(queueOperatorCampaign).not.toHaveBeenCalled();
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

  it("returns 400 with invalid JSON", async () => {
    const request = new Request("https://drako.systems/api/internal/socialflow/automation/trigger", {
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

  it("returns 400 with non-allowed automationType", async () => {
    const response = await POST(buildRequest({
      ...buildValidBody(),
      automationType: "unknown_automation",
    }, {
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-invalid-automation-type",
    }));

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_BAD_REQUEST");
  });

  it("returns response shape compatible with SocialFlowAutomationTriggerResponse", async () => {
    const response = await POST(buildRequest({
      ...buildValidBody(),
      tenantId: "tenant-from-body",
      source: "system",
      requestedBy: null,
    }, {
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-shape",
      "X-Drako-Tenant-Id": "tenant-from-header",
    }));

    expect(response.status).toBe(202);
    const payload = await response.json() as Record<string, unknown>;

    expect(payload).toHaveProperty("service", "socialflow");
    expect(payload).toHaveProperty("runtime", "socialcors");
    expect(payload).toHaveProperty("accepted", true);
    expect(payload).toHaveProperty("automationId");
    expect(payload).toHaveProperty("automationType", "generate_schedule");
    expect(payload).toHaveProperty("requestId", "req-shape");
    expect(payload).toHaveProperty("tenantId", "tenant-from-body");
    expect(payload).toHaveProperty("timestamp");
    expect(payload).toHaveProperty("status");
  });

  it("does not import forbidden modules and protected files remain unchanged", () => {
    const routeSource = readFileSync(
      "apps/socialcors/src/app/api/internal/socialflow/automation/trigger/route.ts",
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
    expect(ownerControlDashboardSource).not.toContain("@/lib/socialflow/contracts/owner-dashboard");
    expect(ownerControlDashboardSource).toContain("@/lib/capabilities/internal-api-clients/socialflow-owner");
  });
});
