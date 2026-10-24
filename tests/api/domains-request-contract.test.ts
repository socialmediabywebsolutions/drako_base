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

describe("/api/domains/request canonical contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTenantAccess.mockResolvedValue({ tenantId: "tenant_secure" });
    mocks.evaluateCustomDomainEntitlement.mockResolvedValue({
      allowed: true,
      code: "ENTITLED",
      message: "ok",
      context: {
        isDrakoFactoryTenant: false,
        planTier: "pro",
        tenantPlan: "pro",
        subscriptionStatus: "active",
        connectStatus: null,
      },
    });
  });

  it("returns 401 when no session is present", async () => {
    mocks.requireTenantAccess.mockRejectedValue(new mocks.UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await POST(
      new Request("https://drako.systems/api/domains/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saasId: "saas_1", domain: "app.client.com" }),
      }),
    );

    expect(response.status).toBe(401);
    const payload = (await response.json()) as { code: string };
    expect(payload.code).toBe("SESSION_REQUIRED");
  });

  it("returns 202 when request is accepted", async () => {
    mocks.requestCustomDomain.mockResolvedValue({
      ok: true,
      code: "DOMAIN_REQUEST_ACCEPTED",
      message: "Domain request accepted",
      correlationId: "corr_1",
      domain: "app.client.com",
      status: "requested",
      token: "token_1",
      httpStatus: 202,
      idempotent: false,
    });

    const response = await POST(
      new Request("https://drako.systems/api/domains/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saasId: "saas_1", domain: "app.client.com" }),
      }),
    );

    expect(response.status).toBe(202);
    const payload = (await response.json()) as { code: string; status: string };
    expect(payload.code).toBe("DOMAIN_REQUEST_ACCEPTED");
    expect(payload.status).toBe("requested");
  });

  it("returns 200 when request is idempotent", async () => {
    mocks.requestCustomDomain.mockResolvedValue({
      ok: true,
      code: "DOMAIN_REQUEST_IDEMPOTENT",
      message: "already exists",
      correlationId: "corr_2",
      domain: "app.client.com",
      status: "active",
      token: "token_1",
      httpStatus: 200,
      idempotent: true,
    });

    const response = await POST(
      new Request("https://drako.systems/api/domains/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saasId: "saas_1", domain: "app.client.com" }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { idempotent: boolean; code: string };
    expect(payload.code).toBe("DOMAIN_REQUEST_IDEMPOTENT");
    expect(payload.idempotent).toBe(true);
  });

  it("returns 409 when hostname is already claimed", async () => {
    mocks.requestCustomDomain.mockResolvedValue({
      ok: false,
      code: "DOMAIN_ALREADY_CLAIMED",
      message: "Domain already claimed",
      correlationId: "corr_3",
      domain: "app.client.com",
      status: "failed",
      httpStatus: 409,
    });

    const response = await POST(
      new Request("https://drako.systems/api/domains/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saasId: "saas_1", domain: "app.client.com" }),
      }),
    );

    expect(response.status).toBe(409);
    const payload = (await response.json()) as { code: string };
    expect(payload.code).toBe("DOMAIN_ALREADY_CLAIMED");
  });
});
