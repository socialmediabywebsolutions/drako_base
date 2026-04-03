import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upsertCanonicalSubscriptionState: vi.fn(),
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  upsertCanonicalSubscriptionState: mocks.upsertCanonicalSubscriptionState,
}));

import { provisionSubscription } from "@/lib/projects/repository";

describe("projects repository canonical billing write-side", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aligns project subscription writes to the canonical tenant_id + saas_slug path", async () => {
    const db = {
      queryOne: vi
        .fn()
        .mockResolvedValueOnce({ slug: "social-project" })
        .mockResolvedValueOnce({ id: "pack_1", policies_json: "[]", cost_policy_json: "{}" }),
      queryAll: vi.fn().mockResolvedValue([]),
      run: vi.fn().mockResolvedValue(true),
    };

    await provisionSubscription(
      "tenant_alpha",
      "proj_123",
      {
        customerId: "cus_123",
        subscriptionId: "sub_123",
        priceId: "price_123",
        productId: "prod_pro",
        status: "active",
        periodEnd: "2026-05-01T00:00:00.000Z",
      },
      db,
    );

    expect(mocks.upsertCanonicalSubscriptionState).toHaveBeenCalledWith({
      tenantId: "tenant_alpha",
      saasSlug: "social-project",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_123",
      status: "active",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
    });
    expect(db.run).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO saas_subscriptions"),
      expect.anything(),
    );
  });

  it("does not write contradictory saas_subscriptions rows when there is no canonical project slug", async () => {
    const db = {
      queryOne: vi.fn().mockResolvedValueOnce(null),
      queryAll: vi.fn().mockResolvedValue([]),
      run: vi.fn().mockResolvedValue(true),
    };

    await provisionSubscription(
      "tenant_alpha",
      "proj_missing",
      {
        customerId: "cus_456",
        subscriptionId: "sub_456",
        priceId: "price_456",
        productId: "prod_starter",
        status: "trialing",
        periodEnd: "2026-05-01T00:00:00.000Z",
      },
      db,
    );

    expect(mocks.upsertCanonicalSubscriptionState).not.toHaveBeenCalled();
    expect(db.run).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO saas_subscriptions"),
      expect.anything(),
    );
  });
});
