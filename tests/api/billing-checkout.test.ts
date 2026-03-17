import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireTenantAccess,
  findMembershipByTenantAndUser,
  hasRequiredWorkspaceRole,
  getWorkspaceUserById,
  getTenantBilling,
  getWorkspaceStripePriceId,
  getStripe,
  getRequestBaseUrl,
  UnauthorizedError,
} = vi.hoisted(() => {
  class HoistedUnauthorizedError extends Error {
    status: number;

    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.status = status;
    }
  }

  return {
    requireTenantAccess: vi.fn(),
    findMembershipByTenantAndUser: vi.fn(),
    hasRequiredWorkspaceRole: vi.fn(),
    getWorkspaceUserById: vi.fn(),
    getTenantBilling: vi.fn(),
    getWorkspaceStripePriceId: vi.fn(),
    getStripe: vi.fn(),
    getRequestBaseUrl: vi.fn(),
    UnauthorizedError: HoistedUnauthorizedError,
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireTenantAccess,
  UnauthorizedError,
}));

vi.mock("@/lib/auth/campamento-core", () => ({
  findMembershipByTenantAndUser,
  getTenantBilling,
  getWorkspaceUserById,
  hasRequiredWorkspaceRole,
}));

vi.mock("@/lib/billing/tenant-workspace", () => ({
  getWorkspaceStripePriceId,
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe,
}));

vi.mock("@/lib/http/base-url", () => ({
  getRequestBaseUrl,
}));

import { POST } from "@/app/api/billing/create-checkout/route";

describe("POST /api/billing/create-checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTenantAccess.mockResolvedValue({
      tenantId: "tenant_1",
      session: {
        userId: "owner_1",
        email: "owner@workspace.test",
      },
    });
    findMembershipByTenantAndUser.mockResolvedValue({
      tenantId: "tenant_1",
      userId: "owner_1",
      role: "OWNER",
    });
    hasRequiredWorkspaceRole.mockReturnValue(true);
  });

  it("returns 503 when Stripe is not configured", async () => {
    getWorkspaceStripePriceId.mockReturnValue("price_pro");
    getStripe.mockResolvedValue(null);

    const response = await POST(new Request("https://base.drako.systems/api/billing/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "PRO" }),
    }));

    expect(response.status).toBe(503);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("STRIPE_NOT_CONFIGURED");
  });

  it("blocks non-admin members from opening checkout", async () => {
    hasRequiredWorkspaceRole.mockReturnValue(false);

    const response = await POST(new Request("https://base.drako.systems/api/billing/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "PRO" }),
    }));

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("FORBIDDEN");
  });
});
