import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryOne: vi.fn(),
  run: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  queryOne: mocks.queryOne,
  run: mocks.run,
  queryAll: vi.fn(),
}));

describe("workspace billing compatibility helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.run.mockResolvedValue(true);
  });

  it("reads an existing tenant_billing row without mutation", async () => {
    mocks.queryOne.mockResolvedValue({
      tenant_id: "tenant_alpha",
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
      plan: "PRO",
      status: "active",
      current_period_end: "2026-05-01T00:00:00.000Z",
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-02T00:00:00.000Z",
    });

    const { getTenantBilling } = await import("@/lib/auth/campamento-core");
    const billing = await getTenantBilling("tenant_alpha");

    expect(billing).toEqual({
      tenantId: "tenant_alpha",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      plan: "PRO",
      status: "active",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    });
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("returns null for pure reads when tenant_billing does not exist", async () => {
    mocks.queryOne.mockResolvedValue(null);

    const { getTenantBilling } = await import("@/lib/auth/campamento-core");
    const billing = await getTenantBilling("tenant_missing");

    expect(billing).toBeNull();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("keeps bootstrap explicit through ensureTenantBilling", async () => {
    mocks.queryOne.mockResolvedValue({
      tenant_id: "tenant_bootstrap",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      plan: "STARTER",
      status: "inactive",
      current_period_end: null,
      created_at: "2026-04-03T00:00:00.000Z",
      updated_at: "2026-04-03T00:00:00.000Z",
    });

    const { ensureTenantBilling } = await import("@/lib/auth/campamento-core");
    const billing = await ensureTenantBilling("tenant_bootstrap");

    expect(billing?.status).toBe("inactive");
    expect(mocks.run).toHaveBeenCalledWith(
      `INSERT INTO tenant_billing (tenant_id, plan, status, created_at, updated_at)
     VALUES (?, 'STARTER', 'inactive', ?, ?)
     ON CONFLICT(tenant_id) DO NOTHING`,
      "tenant_bootstrap",
      expect.any(String),
      expect.any(String),
    );
  });
});
