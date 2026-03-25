import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  UnauthorizedError,
  requireOwnerAccess,
  listFactoryControlPlane,
  getFactoryControlPlaneItem,
  setFactoryControlPlaneStatus,
  archiveFactoryControlPlaneSaas,
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
    listFactoryControlPlane: vi.fn(),
    getFactoryControlPlaneItem: vi.fn(),
    setFactoryControlPlaneStatus: vi.fn(),
    archiveFactoryControlPlaneSaas: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireOwnerAccess,
  UnauthorizedError,
}));

vi.mock("@/lib/factory/control-plane", () => ({
  listFactoryControlPlane,
  getFactoryControlPlaneItem,
  setFactoryControlPlaneStatus,
  archiveFactoryControlPlaneSaas,
}));

import { GET, POST } from "@/app/api/factory/route";

const baseItem = {
  saasId: "runtime_ops_alpha",
  displayName: "Runtime Ops Alpha",
  template: "basic-operational-saas",
  status: "ACTIVE",
  createdBy: null,
  supportsOperatorSurface: true,
  metadata: { operatorTenantId: "tenant_factory" },
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  runtimeRegistered: true,
  operationalSummary: null,
  latestActivityAt: null,
};

function buildRequest(body?: unknown) {
  return new Request("https://drako.systems/api/factory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerAccess.mockResolvedValue({ tenantId: "owner" });
    listFactoryControlPlane.mockResolvedValue([baseItem]);
    getFactoryControlPlaneItem.mockResolvedValue(baseItem);
    setFactoryControlPlaneStatus.mockResolvedValue({ ...baseItem, status: "DEGRADED" });
    archiveFactoryControlPlaneSaas.mockResolvedValue({ ...baseItem, status: "ARCHIVED" });
  });

  it("lists registered factory SaaS", async () => {
    const response = await GET(new Request("https://drako.systems/api/factory") as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as { items: typeof baseItem[] };
    expect(payload.items).toHaveLength(1);
  });

  it("returns one factory SaaS when saasId is provided", async () => {
    const response = await GET(new Request("https://drako.systems/api/factory?saasId=runtime_ops_alpha") as any);

    expect(response.status).toBe(200);
    const payload = await response.json() as { item: typeof baseItem };
    expect(payload.item.saasId).toBe("runtime_ops_alpha");
  });

  it("updates lifecycle status", async () => {
    const response = await POST(buildRequest({
      action: "set_status",
      saasId: "runtime_ops_alpha",
      status: "DEGRADED",
    }) as any);

    expect(response.status).toBe(200);
    expect(setFactoryControlPlaneStatus).toHaveBeenCalledWith("runtime_ops_alpha", "DEGRADED");
  });

  it("archives a factory SaaS", async () => {
    const response = await POST(buildRequest({
      action: "archive",
      saasId: "runtime_ops_alpha",
    }) as any);

    expect(response.status).toBe(200);
    expect(archiveFactoryControlPlaneSaas).toHaveBeenCalledWith("runtime_ops_alpha");
  });

  it("enforces owner auth", async () => {
    requireOwnerAccess.mockRejectedValue(new UnauthorizedError("OWNER_REQUIRED", 403));

    const response = await GET(new Request("https://drako.systems/api/factory") as any);

    expect(response.status).toBe(403);
  });
});
