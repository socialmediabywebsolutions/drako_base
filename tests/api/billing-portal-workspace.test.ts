import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireTenantAccess,
  findMembershipByTenantAndUser,
  hasRequiredWorkspaceRole,
  getTenantBilling,
  getStripe,
  getRequestBaseUrl,
  queryOne,
  getCanonicalSubscriptionState,
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
    getTenantBilling: vi.fn(),
    getStripe: vi.fn(),
    getRequestBaseUrl: vi.fn(),
    queryOne: vi.fn(),
    getCanonicalSubscriptionState: vi.fn(),
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
  hasRequiredWorkspaceRole,
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe,
}));

vi.mock("@/lib/http/base-url", () => ({
  getRequestBaseUrl,
}));

vi.mock("@/lib/db", () => ({
  queryOne,
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  getCanonicalSubscriptionState,
}));

import { POST } from "@/app/api/billing/portal/route";

describe("POST /api/billing/portal workspace billing", () => {
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
    getRequestBaseUrl.mockReturnValue("https://base.drako.systems");
    queryOne.mockResolvedValue(null);
    getCanonicalSubscriptionState.mockResolvedValue(null);
  });

  it("returns NEEDS_BILLING when the workspace row does not exist", async () => {
    getTenantBilling.mockResolvedValue(null);

    const response = await POST(new Request("https://base.drako.systems/api/billing/portal", {
      method: "POST",
    }));

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("NEEDS_BILLING");
  });

  it("opens the Stripe portal when workspace billing exists", async () => {
    getTenantBilling.mockResolvedValue({
      tenantId: "tenant_1",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_existing",
      plan: "PRO",
      status: "active",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    });
    const createPortalSession = vi.fn().mockResolvedValue({
      url: "https://billing.stripe.test/session/portal_1",
    });
    getStripe.mockResolvedValue({
      billingPortal: {
        sessions: {
          create: createPortalSession,
        },
      },
    });

    const response = await POST(new Request("https://base.drako.systems/api/billing/portal", {
      method: "POST",
    }));

    expect(response.status).toBe(200);
    expect(createPortalSession).toHaveBeenCalledWith({
      customer: "cus_existing",
      return_url: "https://base.drako.systems/socialflow/settings/billing",
    });
  });
});
