import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStripe: vi.fn(),
  upsertTenantBilling: vi.fn(),
}));

vi.mock("@/lib/cf", () => ({
  env: () => ({
    DRAKO_BASE_STARTER_PRICE_ID: "price_starter",
    DRAKO_BASE_PRO_PRICE_ID: "price_pro",
    DRAKO_BASE_ENTERPRISE_PRICE_ID: "price_enterprise",
  }),
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: mocks.getStripe,
}));

vi.mock("@/lib/auth/campamento-core", () => ({
  upsertTenantBilling: mocks.upsertTenantBilling,
}));

import {
  extractWorkspaceBillingMetadata,
  getWorkspaceStripePriceId,
  syncWorkspaceBillingFromCheckout,
  syncWorkspaceBillingFromSubscription,
} from "@/lib/billing/tenant-workspace";

describe("tenant workspace billing helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts canonical tenant_workspace metadata", () => {
    expect(
      extractWorkspaceBillingMetadata({
        tenantId: "tenant_workspace_1",
        plan: "pro",
        scope: "tenant_workspace",
      } as any),
    ).toEqual({
      tenantId: "tenant_workspace_1",
      plan: "PRO",
      scope: "tenant_workspace",
    });
  });

  it("resolves canonical Stripe price ids by workspace plan", () => {
    expect(getWorkspaceStripePriceId("STARTER")).toBe("price_starter");
    expect(getWorkspaceStripePriceId("PRO")).toBe("price_pro");
    expect(getWorkspaceStripePriceId("ENTERPRISE")).toBe("price_enterprise");
  });

  it("persists tenant_workspace subscriptions into tenant_billing", async () => {
    await syncWorkspaceBillingFromSubscription({
      id: "sub_workspace_1",
      status: "active",
      current_period_end: 1_700_000_000,
      customer: "cus_workspace_1",
      metadata: {
        tenantId: "tenant_workspace_1",
        plan: "PRO",
        scope: "tenant_workspace",
      },
    } as any);

    expect(mocks.upsertTenantBilling).toHaveBeenCalledWith({
      tenantId: "tenant_workspace_1",
      stripeCustomerId: "cus_workspace_1",
      stripeSubscriptionId: "sub_workspace_1",
      plan: "PRO",
      status: "active",
      currentPeriodEnd: "2023-11-14T22:13:20.000Z",
    });
  });

  it("supports explicit status overrides for workspace invoice flows", async () => {
    await syncWorkspaceBillingFromSubscription(
      {
        id: "sub_workspace_1",
        status: "active",
        current_period_end: 1_700_000_000,
        customer: "cus_workspace_1",
        metadata: {
          tenantId: "tenant_workspace_1",
          plan: "STARTER",
          scope: "tenant_workspace",
        },
      } as any,
      { statusOverride: "past_due" },
    );

    expect(mocks.upsertTenantBilling).toHaveBeenCalledWith({
      tenantId: "tenant_workspace_1",
      stripeCustomerId: "cus_workspace_1",
      stripeSubscriptionId: "sub_workspace_1",
      plan: "STARTER",
      status: "past_due",
      currentPeriodEnd: "2023-11-14T22:13:20.000Z",
    });
  });

  it("syncs checkout.session.completed into tenant_billing without touching product billing", async () => {
    mocks.getStripe.mockResolvedValue({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_workspace_1",
          status: "active",
          current_period_end: 1_700_000_000,
          customer: "cus_workspace_1",
          metadata: {
            tenantId: "tenant_workspace_1",
            plan: "ENTERPRISE",
            scope: "tenant_workspace",
          },
        }),
      },
    });

    await syncWorkspaceBillingFromCheckout({
      id: "cs_workspace_1",
      subscription: "sub_workspace_1",
      customer: "cus_workspace_1",
      metadata: {
        tenantId: "tenant_workspace_1",
        plan: "ENTERPRISE",
        scope: "tenant_workspace",
      },
    } as any);

    expect(mocks.upsertTenantBilling).toHaveBeenCalledWith({
      tenantId: "tenant_workspace_1",
      stripeCustomerId: "cus_workspace_1",
      stripeSubscriptionId: "sub_workspace_1",
      plan: "ENTERPRISE",
      status: "active",
      currentPeriodEnd: "2023-11-14T22:13:20.000Z",
    });
  });
});
