import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    status: number;
    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.status = status;
    }
  }

  return {
    ensureDatabase: vi.fn(),
    requireTenantAccess: vi.fn(),
    evaluateCustomDomainEntitlement: vi.fn(),
    requestCustomDomain: vi.fn(),
    UnauthorizedError,
  };
});

vi.mock("@/lib/db", () => ({
  ensureDatabase: mocks.ensureDatabase,
}));

vi.mock("@/lib/auth/session", () => ({
  requireTenantAccess: mocks.requireTenantAccess,
  UnauthorizedError: mocks.UnauthorizedError,
}));

vi.mock("@/lib/domains/entitlement-gate", () => ({
  evaluateCustomDomainEntitlement: mocks.evaluateCustomDomainEntitlement,
}));

vi.mock("@/lib/domains/domain-service", () => ({
  requestCustomDomain: mocks.requestCustomDomain,
}));

import { POST } from "@/app/api/domains/request/route";

describe("/api/domains/request entitlement gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTenantAccess.mockResolvedValue({ tenantId: "tenant_secure" });
    mocks.evaluateCustomDomainEntitlement.mockResolvedValue({
      allowed: false,
      code: "PLAN_LOCKED",
      message: "Plan does not allow custom domains",
      context: {
        isDrakoFactoryTenant: false,
        planTier: "starter",
        tenantPlan: "starter",
        subscriptionStatus: "active",
        connectStatus: null,
      },
    });
  });

  it("returns 403 when tenant has no entitlement", async () => {
    const request = new Request("https://drako.systems/api/domains/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ saasId: "saas_1", domain: "app.client.com" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(mocks.requestCustomDomain).not.toHaveBeenCalled();
  });
});
