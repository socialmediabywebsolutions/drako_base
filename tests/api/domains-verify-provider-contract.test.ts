import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    status: number;
    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.status = status;
    }
  }

  class DomainServiceError extends Error {
    code: string;
    httpStatus: number;
    correlationId: string;

    constructor(input: { code: string; message: string; httpStatus: number; correlationId: string }) {
      super(input.message);
      this.name = "DomainServiceError";
      this.code = input.code;
      this.httpStatus = input.httpStatus;
      this.correlationId = input.correlationId;
    }
  }

  return {
    ensureDatabase: vi.fn(),
    requireTenantAccess: vi.fn(),
    evaluateCustomDomainEntitlement: vi.fn(),
    verifyAndActivate: vi.fn(),
    UnauthorizedError,
    DomainServiceError,
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
  verifyAndActivate: mocks.verifyAndActivate,
  DomainServiceError: mocks.DomainServiceError,
}));

import { POST } from "@/app/api/domains/verify/route";

describe("/api/domains/verify provider contract", () => {
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

  it("returns 503 when Cloudflare provider is misconfigured in production", async () => {
    mocks.verifyAndActivate.mockRejectedValue(
      new mocks.DomainServiceError({
        code: "DOMAIN_PROVIDER_MISCONFIGURED",
        message: "Cloudflare provider is not configured for production domain activation",
        httpStatus: 503,
        correlationId: "corr_cf_missing",
      }),
    );

    const response = await POST(
      new Request("https://drako.systems/api/domains/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saasId: "saas_1" }),
      }),
    );

    expect(response.status).toBe(503);
    const payload = await response.json() as { code: string; correlationId: string };
    expect(payload.code).toBe("DOMAIN_PROVIDER_MISCONFIGURED");
    expect(payload.correlationId).toBe("corr_cf_missing");
  });
});
