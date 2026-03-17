import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryOne: vi.fn(),
  run: vi.fn(),
  getCanonicalBillingEntitlements: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  queryOne: mocks.queryOne,
  run: mocks.run,
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  getCanonicalBillingEntitlements: mocks.getCanonicalBillingEntitlements,
}));

import { enforceBilling } from "@/lib/billing/enforce-billing";

describe("enforceBilling canonical entitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.run.mockResolvedValue(true);
  });

  it("fails closed with needs_billing when no verified subscription exists", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      subscriptionStatus: null,
      hasVerifiedSubscription: false,
      limits: {},
    });

    const result = await enforceBilling("drako", "tenant_alpha", "ai_calls", 1);
    expect(result).toEqual({ allowed: false, reason: "needs_billing", status: 403 });
  });

  it("fails closed when quota is undefined in entitlements", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      subscriptionStatus: "active",
      hasVerifiedSubscription: true,
      limits: {},
    });

    const result = await enforceBilling("drako", "tenant_alpha", "ai_calls", 1);
    expect(result).toEqual({ allowed: false, reason: "QUOTA_NOT_DEFINED", status: 403 });
  });

  it("allows active/trial/trialing without quota increment", async () => {
    for (const status of ["active", "trial", "trialing"]) {
      mocks.getCanonicalBillingEntitlements.mockResolvedValueOnce({
        tenantId: "t1",
        saasSlug: "drako",
        subscriptionStatus: status,
        hasVerifiedSubscription: true,
        limits: {},
      });
      const result = await enforceBilling("drako", "t1", "feature_access", 0);
      expect(result).toEqual({ allowed: true, status: 200 });
    }
  });

  it("blocks past_due for any action", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "t1",
      saasSlug: "drako",
      subscriptionStatus: "past_due",
      hasVerifiedSubscription: true,
      limits: {},
    });
    const result = await enforceBilling("drako", "t1", "feature_access", 0);
    expect(result).toEqual({ allowed: false, reason: "PAST_DUE_BLOCK", status: 402 });
    expect(mocks.run).toHaveBeenCalled();
  });

  it("blocks incomplete explicitly", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "t1",
      saasSlug: "drako",
      subscriptionStatus: "incomplete",
      hasVerifiedSubscription: true,
      limits: {},
    });
    const result = await enforceBilling("drako", "t1", "feature_access", 0);
    expect(result).toEqual({ allowed: false, reason: "SUBSCRIPTION_INCOMPLETE", status: 402 });
  });

  it("blocks unpaid/canceled/incomplete_expired and unknown", async () => {
    const blocked = ["unpaid", "canceled", "incomplete_expired", "unknown_state"] as const;
    for (const status of blocked) {
      mocks.getCanonicalBillingEntitlements.mockResolvedValueOnce({
        tenantId: "t1",
        saasSlug: "drako",
        subscriptionStatus: status,
        hasVerifiedSubscription: true,
        limits: {},
      });
      const result = await enforceBilling("drako", "t1", "feature_access", 0);
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(402);
    }
  });
});
