import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
const runPostRecoveryAction = vi.hoisted(() => vi.fn());
const launchOperatorCampaign = vi.hoisted(() => vi.fn());
const testOperatorAiReply = vi.hoisted(() => vi.fn());
vi.mock("@/lib/socialflow/internal-api/operator-actions", () => ({ runPostRecoveryAction, launchOperatorCampaign, testOperatorAiReply }));

import { POST } from "@/app/api/internal/socialflow/operator/actions/route";

const recoveryResult = {
  scanned: 3,
  affected: 1,
  skipped: 2,
  items: [{ id: "p1", title: "Post", previousStatus: "PUBLISHING", nextStatus: "SCHEDULED", ok: true, reason: null }],
  message: "Recovered 1 stale PUBLISHING post(s).",
};

describe("POST /api/internal/socialflow/operator/actions", () => {
  beforeEach(() => {
    process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN_TEST = "test-service-token";
    delete process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_API_SERVICE_TOKEN;
    runPostRecoveryAction.mockReset().mockResolvedValue(recoveryResult);
    launchOperatorCampaign.mockReset().mockResolvedValue({ results: [{ tenantId: "tenant-1", ok: true, campaignId: "c1" }] });
    testOperatorAiReply.mockReset().mockResolvedValue({ kind: "AI_GENERATED", suggestedReply: "Hola", aiMetadata: null });
  });

  function buildValidBody() {
    return {
      actionType: "recover_stale_publishing",
      source: "campobase",
      tenantId: "tenant-1",
      correlationId: "corr-1",
      requestedBy: "campobase-ops",
      reason: "maintenance-window",
      payload: {
        saasId: "socialflow",
      },
    };
  }

  function buildRequest(body?: unknown, headers?: HeadersInit) {
    return new Request("https://drako.systems/api/internal/socialflow/operator/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(headers ?? {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  it("executes the action and returns 200 with its real result", async () => {
    const response = await POST(buildRequest(buildValidBody(), {
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-operator-202",
      "Idempotency-Key": "idem-1",
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-SocialCors-Contract-Version")).toBe("2026-10-09");
    const payload = await response.json() as {
      service: string;
      runtime: string;
      accepted: boolean;
      actionId: string;
      actionType: string;
      requestId: string;
      tenantId: string | null;
      timestamp: string;
      status: string;
      result: unknown;
    };

    expect(payload.service).toBe("socialflow");
    expect(payload.runtime).toBe("socialcors");
    expect(payload.accepted).toBe(true);
    expect(typeof payload.actionId).toBe("string");
    expect(payload.actionType).toBe("recover_stale_publishing");
    expect(payload.requestId).toBe("req-operator-202");
    expect(payload.tenantId).toBe("tenant-1");
    expect(typeof payload.timestamp).toBe("string");
    expect(payload.status).toBe("completed");
    expect(payload.result).toEqual(recoveryResult);
    expect(runPostRecoveryAction).toHaveBeenCalledWith({ action: "recover_stale_publishing", tenantId: "tenant-1", saasId: "socialflow" });
  });

  const authHeaders = {
    Authorization: "Bearer test-service-token",
    "X-Drako-Control-Plane": "campobase",
    "X-Drako-Request-Id": "req-x",
  };

  it("launch_campaign validates tenants and title strictly", async () => {
    const empty = await POST(buildRequest({ ...buildValidBody(), actionType: "launch_campaign", tenantId: null, payload: { tenants: [], title: "Black Friday" } }, authHeaders));
    expect(empty.status).toBe(400);
    const noTitle = await POST(buildRequest({ ...buildValidBody(), actionType: "launch_campaign", tenantId: null, payload: { tenants: ["t1"] } }, authHeaders));
    expect(noTitle.status).toBe(400);
    expect(launchOperatorCampaign).not.toHaveBeenCalled();

    const ok = await POST(buildRequest({ ...buildValidBody(), actionType: "launch_campaign", tenantId: null, payload: { tenants: ["t1", "t2"], title: "Black Friday", scheduledAt: "2026-11-27T10:00:00Z" } }, authHeaders));
    expect(ok.status).toBe(200);
    expect(launchOperatorCampaign).toHaveBeenCalledWith({
      actionType: "launch_campaign",
      tenants: ["t1", "t2"],
      saasId: "socialflow",
      title: "Black Friday",
      scheduledAt: "2026-11-27T10:00:00Z",
    });
  });

  it("test_ai_reply requires a message and runs the AI reply in SocialCors", async () => {
    const missing = await POST(buildRequest({ ...buildValidBody(), actionType: "test_ai_reply", payload: {} }, authHeaders));
    expect(missing.status).toBe(400);

    const ok = await POST(buildRequest({ ...buildValidBody(), actionType: "test_ai_reply", payload: { message: "¿Precio?", threadType: "COMMENT", niche: "yoga" } }, authHeaders));
    expect(ok.status).toBe(200);
    expect(testOperatorAiReply).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-1", message: "¿Precio?", threadType: "COMMENT", niche: "yoga", provider: "INSTAGRAM" }));
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
    const request = new Request("https://drako.systems/api/internal/socialflow/operator/actions", {
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

  it("returns 400 with non-allowed actionType", async () => {
    const response = await POST(buildRequest({
      ...buildValidBody(),
      actionType: "unknown_action",
    }, {
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-invalid-action-type",
    }));

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_BAD_REQUEST");
  });

  it("returns response shape compatible with SocialFlowOperatorActionResponse", async () => {
    const response = await POST(buildRequest({
      ...buildValidBody(),
      tenantId: "tenant-from-body",
      source: "system",
      requestedBy: null,
      reason: null,
    }, {
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-shape",
      "X-Drako-Tenant-Id": "tenant-from-header",
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;

    expect(payload).toHaveProperty("service", "socialflow");
    expect(payload).toHaveProperty("runtime", "socialcors");
    expect(payload).toHaveProperty("accepted", true);
    expect(payload).toHaveProperty("actionId");
    expect(payload).toHaveProperty("actionType", "recover_stale_publishing");
    expect(payload).toHaveProperty("requestId", "req-shape");
    expect(payload).toHaveProperty("tenantId", "tenant-from-body");
    expect(payload).toHaveProperty("timestamp");
    expect(payload).toHaveProperty("status");
  });

  it("does not import forbidden modules and protected files remain unchanged", () => {
    const routeSource = readFileSync(
      "apps/socialcors/src/app/api/internal/socialflow/operator/actions/route.ts",
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
