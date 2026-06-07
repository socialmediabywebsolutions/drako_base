import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const {
  UnauthorizedError,
  requireOwnerAccess,
  getPlatformOperatorSurface,
  refreshPlatformOperatorSurface,
  runPlatformAutomationAction,
  setPlatformAutomationEnabled,
  executePlatformIntegrationOperation,
  validatePlatformIntegration,
  resolvePlatformOperatorError,
} = vi.hoisted(() => {
  class HoistedUnauthorizedError extends Error {
    status: number;

    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.name = "UnauthorizedError";
      this.status = status;
    }
  }

  return {
    UnauthorizedError: HoistedUnauthorizedError,
    requireOwnerAccess: vi.fn(),
    getPlatformOperatorSurface: vi.fn(),
    refreshPlatformOperatorSurface: vi.fn(),
    runPlatformAutomationAction: vi.fn(),
    setPlatformAutomationEnabled: vi.fn(),
    executePlatformIntegrationOperation: vi.fn(),
    validatePlatformIntegration: vi.fn(),
    resolvePlatformOperatorError: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireOwnerAccess,
  UnauthorizedError,
}));

vi.mock("@/lib/campamento-base/platform-operator-service", () => ({
  getPlatformOperatorSurface,
  refreshPlatformOperatorSurface,
  runPlatformAutomationAction,
  setPlatformAutomationEnabled,
  executePlatformIntegrationOperation,
  validatePlatformIntegration,
  resolvePlatformOperatorError,
}));

import { GET, POST } from "@/app/api/campobase/platform/route";

const baseSurface = {
  tenantId: "tenant_socialflow",
  saasId: "socialflow",
  summary: {
    tenantId: "tenant_socialflow",
    saasId: "socialflow",
    overallStatus: "healthy",
    freshnessStatus: "fresh",
    openIncidentsCount: 0,
    latestActivityAt: "2024-01-01T00:00:00.000Z",
    latestSnapshotAt: "2024-01-01T00:05:00.000Z",
    recommendation: "Operational activity looks recent.",
  },
  latestHealthSnapshot: {
    id: "health_1",
    tenantId: "tenant_socialflow",
    saasId: "socialflow",
    scopeType: "saas",
    scopeKey: "socialflow",
    healthStatus: "healthy",
    freshnessStatus: "fresh",
    lastActivityAt: "2024-01-01T00:00:00.000Z",
    openIncidentsCount: 0,
    summary: "Healthy",
    capturedAt: "2024-01-01T00:05:00.000Z",
  },
  openIncidents: [],
  recentActivity: [],
  automations: [],
  integrations: [],
};

function buildRequest(body?: unknown) {
  return new Request("https://drako.systems/api/campobase/platform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/campobase/platform", () => {
  it("uses canonical platform operator service dependency and keeps legacy adapter intact", () => {
    const routeSource = readFileSync(
      "src/app/api/operator/platform/route.ts",
      "utf8",
    );
    const legacySource = readFileSync(
      "src/lib/campobase/platform-operator-service.ts",
      "utf8",
    );

    expect(routeSource).toContain("@/lib/campamento-base/platform-operator-service");
    expect(routeSource).not.toContain("@/lib/campobase/platform-operator-service");
    expect(routeSource).not.toContain("from \"@/lib/campobase/");
    expect(legacySource).toContain("temporary adapter");
    expect(legacySource).toContain("@/lib/campamento-base/platform-operator-service");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerAccess.mockResolvedValue({ tenantId: "owner" });
    getPlatformOperatorSurface.mockResolvedValue(baseSurface);
    refreshPlatformOperatorSurface.mockResolvedValue(baseSurface);
    runPlatformAutomationAction.mockResolvedValue({ ok: true });
    setPlatformAutomationEnabled.mockResolvedValue({ enabled: true });
    executePlatformIntegrationOperation.mockResolvedValue({ ok: true, result: { messageId: "msg_1" } });
    validatePlatformIntegration.mockResolvedValue({ ok: true });
    resolvePlatformOperatorError.mockImplementation((error: Error) => ({
      status: 500,
      code: "PLATFORM_OPERATOR_UNEXPECTED_ERROR",
      message: error.message,
    }));
  });

  it("GET returns the composed operator surface", async () => {
    const response = await GET(
      new Request("https://drako.systems/api/campobase/platform?tenantId=tenant_socialflow&saasId=socialflow") as any,
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as { surface: typeof baseSurface };
    expect(payload.surface).toEqual(baseSurface);
    expect(getPlatformOperatorSurface).toHaveBeenCalledWith("tenant_socialflow", "socialflow");
  });

  it("GET requires tenantId and saasId", async () => {
    const response = await GET(new Request("https://drako.systems/api/campobase/platform") as any);

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("PLATFORM_OPERATOR_IDENTITY_REQUIRED");
  });

  it("POST refresh returns updated surface", async () => {
    const response = await POST(buildRequest({
      action: "refresh",
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
    }) as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as { action: string; surface: typeof baseSurface };
    expect(payload.action).toBe("refresh");
    expect(payload.surface).toEqual(baseSurface);
    expect(refreshPlatformOperatorSurface).toHaveBeenCalledWith("tenant_socialflow", "socialflow");
  });

  it("POST runs automation and reloads surface", async () => {
    const response = await POST(buildRequest({
      action: "run_automation",
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
      automationKey: "socialflow.content_generation",
    }) as any);

    expect(response.status).toBe(200);
    expect(runPlatformAutomationAction).toHaveBeenCalledWith({
      action: "run_automation",
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
      automationKey: "socialflow.content_generation",
    });
    expect(getPlatformOperatorSurface).toHaveBeenCalledWith("tenant_socialflow", "socialflow");
  });

  it("POST validates integration and reloads surface", async () => {
    const response = await POST(buildRequest({
      action: "validate_integration",
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
      integrationKey: "linkedin",
    }) as any);

    expect(response.status).toBe(200);
    expect(validatePlatformIntegration).toHaveBeenCalledWith({
      action: "validate_integration",
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
      integrationKey: "linkedin",
    });
  });

  it("POST executes an integration operation and reloads the surface", async () => {
    const response = await POST(buildRequest({
      action: "execute_integration_operation",
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
      integrationKey: "whatsapp",
      operationKey: "send_message",
      payload: {
        to: "+34600111222",
        body: "Hola desde Drako",
      },
    }) as any);

    expect(response.status).toBe(200);
    expect(executePlatformIntegrationOperation).toHaveBeenCalledWith({
      action: "execute_integration_operation",
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
      integrationKey: "whatsapp",
      operationKey: "send_message",
      payload: {
        to: "+34600111222",
        body: "Hola desde Drako",
      },
    });
    expect(getPlatformOperatorSurface).toHaveBeenCalledWith("tenant_clinic", "saas_clinic");
  });

  it("POST toggles automation enabled state", async () => {
    await POST(buildRequest({
      action: "disable_automation",
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
      automationKey: "socialflow.health_check",
    }) as any);

    expect(setPlatformAutomationEnabled).toHaveBeenCalledWith({
      action: "disable_automation",
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
      automationKey: "socialflow.health_check",
      enabled: false,
    });
  });

  it("enforces owner auth", async () => {
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("OWNER_REQUIRED", 403));

    const response = await GET(
      new Request("https://drako.systems/api/campobase/platform?tenantId=tenant_socialflow&saasId=socialflow") as any,
    );

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string; message: string };
    expect(payload.code).toBe("UNAUTHORIZED");
    expect(payload.message).toBe("OWNER_REQUIRED");
  });
});
