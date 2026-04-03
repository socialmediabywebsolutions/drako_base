import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  writeBillingAuditLog: vi.fn(),
  createTenant: vi.fn(),
  createTenantUser: vi.fn(),
  upsertCanonicalSubscriptionState: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  run: mocks.run,
  queryOne: mocks.queryOne,
  queryAll: mocks.queryAll,
}));

vi.mock("@/lib/billing/billing-audit", () => ({
  writeBillingAuditLog: mocks.writeBillingAuditLog,
}));

vi.mock("@/lib/tenants/services", () => ({
  createTenant: mocks.createTenant,
  createTenantUser: mocks.createTenantUser,
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  upsertCanonicalSubscriptionState: mocks.upsertCanonicalSubscriptionState,
}));

import { provisionTenantFromStripe } from "@/lib/billing/provisioning_workflow";

describe("provisionTenantFromStripe canonical write-side", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.run.mockResolvedValue(true);
    mocks.writeBillingAuditLog.mockResolvedValue(true);
    mocks.createTenant.mockResolvedValue("tenant_created");
    mocks.createTenantUser.mockResolvedValue(true);
  });

  it("aligns provisioning writes with the canonical saas_subscriptions helper", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({
        plan_code: "pro",
        limits_json: JSON.stringify({ ai_calls: 1000 }),
        departments_json: JSON.stringify(["sales"]),
      })
      .mockResolvedValueOnce({ tenant_id: "tenant_alpha" });

    const result = await provisionTenantFromStripe({
      eventId: "evt_provisioning_1",
      type: "checkout.session.completed",
      data: {
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        stripePriceId: "price_123",
        customerEmail: "owner@example.com",
        saasSlug: "socialflow",
        tenantId: "tenant_alpha",
        planCode: "pro",
        currentPeriodStart: "2026-04-01T00:00:00.000Z",
        currentPeriodEnd: "2026-05-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      },
    });

    expect(result).toEqual({ success: true, tenantId: "tenant_alpha" });
    expect(mocks.upsertCanonicalSubscriptionState).toHaveBeenCalledWith({
      tenantId: "tenant_alpha",
      saasSlug: "socialflow",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_123",
      planCode: "pro",
      status: "active",
      currentPeriodStart: "2026-04-01T00:00:00.000Z",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    });
    expect(mocks.run).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO saas_subscriptions"),
      expect.anything(),
    );
  });

  it("uses an existing canonical subscription tenant before creating a new tenant", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({
        plan_code: "starter",
        limits_json: JSON.stringify({ workspaces: 5 }),
        departments_json: JSON.stringify([]),
      })
      .mockResolvedValueOnce({ tenant_id: "tenant_existing" });

    const result = await provisionTenantFromStripe({
      eventId: "evt_provisioning_2",
      type: "checkout.session.completed",
      data: {
        stripeCustomerId: "cus_456",
        stripeSubscriptionId: "sub_456",
        stripePriceId: "price_456",
        customerEmail: "owner@example.com",
        saasSlug: "drako",
      },
    });

    expect(result).toEqual({ success: true, tenantId: "tenant_existing" });
    expect(mocks.createTenant).not.toHaveBeenCalled();
    expect(mocks.createTenantUser).not.toHaveBeenCalled();
    expect(mocks.upsertCanonicalSubscriptionState).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant_existing",
        saasSlug: "drako",
        stripeSubscriptionId: "sub_456",
      }),
    );
  });
});
