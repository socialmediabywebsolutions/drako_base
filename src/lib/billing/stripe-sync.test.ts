import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: vi.fn(),
  getCanonicalBillingSnapshot: vi.fn(),
  retrieve: vi.fn(),
  stripeCtor: vi.fn(),
}));

vi.mock("@/lib/cf", () => ({
  env: mocks.env,
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  getCanonicalBillingSnapshot: mocks.getCanonicalBillingSnapshot,
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    subscriptions = {
      retrieve: mocks.retrieve,
    };

    constructor(...args: unknown[]) {
      mocks.stripeCtor(...args);
    }
  },
}));

import { syncStripeSubscription } from "@/lib/billing/stripe-sync";

function createDb() {
  const operations: Array<{ sql: string; params: unknown[] }> = [];

  return {
    operations,
    prepare: vi.fn((sql: string) => ({
      bind: (...params: unknown[]) => {
        operations.push({ sql, params });
        return {
          first: async () => {
            if (sql.includes("FROM saas_instances")) {
              return { id: "saas_1", tenant_id: "tenant_alpha", slug: "drako" };
            }
            return null;
          },
          run: async () => ({ success: true }),
        };
      },
    })),
  };
}

describe("stripe-sync canonical billing alignment", () => {
  const originalStripeSecret = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    mocks.env.mockReturnValue(null);
    mocks.retrieve.mockResolvedValue({
      id: "sub_123",
      status: "active",
      customer: "cus_123",
      items: {
        data: [
          {
            price: {
              id: "price_sync_123",
              unit_amount: 2500,
              currency: "eur",
            },
          },
        ],
      },
    });
  });

  afterAll(() => {
    if (originalStripeSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
      return;
    }
    process.env.STRIPE_SECRET_KEY = originalStripeSecret;
  });

  it("syncs from canonical billing snapshot resolved by instance slug", async () => {
    const db = createDb();
    mocks.getCanonicalBillingSnapshot.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_1",
      subscription: {
        status: "active",
        planCode: "pro",
        currentPeriodStart: null,
        currentPeriodEnd: "2026-05-01T00:00:00.000Z",
        trial: false,
        cancelAtPeriodEnd: false,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        stripePriceId: "price_sync_123",
        updatedAt: "2026-04-03T00:00:00.000Z",
      },
      entitlements: {
        limits: {},
        features: [],
        usage: {},
      },
    });

    await syncStripeSubscription(db, "tenant_alpha", "saas_1");

    expect(mocks.getCanonicalBillingSnapshot).toHaveBeenCalledWith({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
    });
    expect(mocks.retrieve).toHaveBeenCalledWith("sub_123");
    expect(db.operations.some((entry) => entry.sql.includes("FROM saas_subscriptions"))).toBe(false);
    expect(
      db.operations.some(
        (entry) =>
          entry.sql.includes("UPDATE saas_instances SET")
          && entry.params[0] === "cus_123"
          && entry.params[1] === "sub_123",
      ),
    ).toBe(true);
  });

  it("fails closed when canonical billing has no syncable subscription", async () => {
    const db = createDb();
    mocks.getCanonicalBillingSnapshot.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_1",
      subscription: {
        status: null,
        planCode: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        trial: null,
        cancelAtPeriodEnd: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        updatedAt: null,
      },
      entitlements: {
        limits: {},
        features: [],
        usage: {},
      },
    });

    await syncStripeSubscription(db, "tenant_alpha", "saas_1");

    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(
      db.operations.some(
        (entry) =>
          entry.sql.includes("INSERT INTO economic_events")
          && String(entry.params[5]).includes("No syncable canonical subscription record found locally."),
      ),
    ).toBe(true);
  });

  it("does not sync blocked canonical statuses such as canceled", async () => {
    const db = createDb();
    mocks.getCanonicalBillingSnapshot.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_1",
      subscription: {
        status: "canceled",
        planCode: "pro",
        currentPeriodStart: null,
        currentPeriodEnd: "2026-05-01T00:00:00.000Z",
        trial: false,
        cancelAtPeriodEnd: true,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        stripePriceId: "price_sync_123",
        updatedAt: "2026-04-03T00:00:00.000Z",
      },
      entitlements: {
        limits: {},
        features: [],
        usage: {},
      },
    });

    await syncStripeSubscription(db, "tenant_alpha", "saas_1");

    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(
      db.operations.some(
        (entry) =>
          entry.sql.includes("INSERT INTO economic_events")
          && String(entry.params[5]).includes("\"subscriptionStatus\":\"canceled\""),
      ),
    ).toBe(true);
  });
});
