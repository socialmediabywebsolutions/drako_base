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
});
