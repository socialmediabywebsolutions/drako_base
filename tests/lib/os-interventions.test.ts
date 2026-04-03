import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCanonicalBillingSnapshot: vi.fn(),
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  getCanonicalBillingSnapshot: mocks.getCanonicalBillingSnapshot,
}));

import { runInterventions } from "@/lib/os/interventions";

function createDb(options?: { appliedActions?: string[] }) {
  const appliedActions = new Set(options?.appliedActions ?? []);
  const operations: Array<{ sql: string; params: unknown[] }> = [];

  return {
    operations,
    prepare(sql: string) {
      return {
        bind: (...params: unknown[]) => ({
          first: async () => {
            if (sql.includes("SELECT id FROM intervention_actions")) {
              const key = `${params[0]}:${params[1]}`;
              return appliedActions.has(key) ? { id: "ia_existing" } : null;
            }
            return null;
          },
          run: async () => {
            operations.push({ sql, params });
            return { success: true };
          },
        }),
      };
    },
  };
}

function buildInstance(overrides?: Record<string, unknown>) {
  return {
    id: "saas_1",
    tenant_id: "tenant_alpha",
    slug: "drako",
    stripe_subscription_id: "sub_123",
    plan_tier: "pro",
    intervention_flags: "[]",
    ...overrides,
  };
}

describe("runInterventions canonical billing alignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCanonicalBillingSnapshot.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_1",
      subscription: {
        status: "active",
        planCode: "pro",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        trial: false,
        cancelAtPeriodEnd: false,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        stripePriceId: "price_123",
        updatedAt: "2026-04-03T00:00:00.000Z",
      },
      entitlements: {
        limits: {},
        features: [],
        usage: {},
      },
    });
  });

  it("uses the canonical tenant + saas snapshot and does not freeze active subscriptions", async () => {
    const db = createDb();

    const actions = await runInterventions(
      db,
      buildInstance(),
      { marginEur: 12, daysInTrial: 2 },
      80,
    );

    expect(actions).toEqual([]);
    expect(mocks.getCanonicalBillingSnapshot).toHaveBeenCalledWith({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
    });
    expect(db.operations.some((entry) => entry.sql.includes("INTERVENTION_APPLIED"))).toBe(false);
  });

  it("freezes expansion when the canonical subscription is in a blocked billing status", async () => {
    const db = createDb();
    mocks.getCanonicalBillingSnapshot.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_1",
      subscription: {
        status: "past_due",
        planCode: "pro",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        trial: false,
        cancelAtPeriodEnd: false,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        stripePriceId: "price_123",
        updatedAt: "2026-04-03T00:00:00.000Z",
      },
      entitlements: {
        limits: {},
        features: [],
        usage: {},
      },
    });

    const actions = await runInterventions(
      db,
      buildInstance(),
      { marginEur: 12, daysInTrial: 2 },
      80,
    );

    expect(actions).toEqual(["FREEZE_EXPANSION"]);
    expect(
      db.operations.some(
        (entry) =>
          entry.sql.includes("INSERT INTO intervention_actions")
          && entry.params[3] === "FREEZE_EXPANSION"
          && entry.params[4] === "BILLING_STATUS_past_due",
      ),
    ).toBe(true);
    expect(
      db.operations.some(
        (entry) =>
          entry.sql.includes("UPDATE saas_instances SET intervention_flags = ?")
          && String(entry.params[0]).includes("billing_risk"),
      ),
    ).toBe(true);
  });

  it("does not freeze when canonical billing has no valid linked subscription", async () => {
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

    const actions = await runInterventions(
      db,
      buildInstance(),
      { marginEur: 12, daysInTrial: 2 },
      80,
    );

    expect(actions).toEqual([]);
    expect(
      db.operations.some(
        (entry) =>
          entry.sql.includes("INSERT INTO intervention_actions")
          && entry.params[3] === "FREEZE_EXPANSION",
      ),
    ).toBe(false);
  });

  it("does not infer billing risk from a canonical subscription belonging to another stripe subscription id", async () => {
    const db = createDb();
    mocks.getCanonicalBillingSnapshot.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_1",
      subscription: {
        status: "canceled",
        planCode: "pro",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        trial: false,
        cancelAtPeriodEnd: true,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_other",
        stripePriceId: "price_123",
        updatedAt: "2026-04-03T00:00:00.000Z",
      },
      entitlements: {
        limits: {},
        features: [],
        usage: {},
      },
    });

    const actions = await runInterventions(
      db,
      buildInstance(),
      { marginEur: 12, daysInTrial: 2 },
      80,
    );

    expect(actions).toEqual([]);
    expect(
      db.operations.some(
        (entry) =>
          entry.sql.includes("INSERT INTO intervention_actions")
          && entry.params[3] === "FREEZE_EXPANSION",
      ),
    ).toBe(false);
  });

  it("preserves the non-billing degrade rule while using canonical billing for lifecycle risk", async () => {
    const db = createDb();

    const actions = await runInterventions(
      db,
      buildInstance({ plan_tier: "trial" }),
      { marginEur: -10, daysInTrial: 25 },
      80,
    );

    expect(actions).toContain("DEGRADE");
    expect(
      db.operations.some(
        (entry) =>
          entry.sql.includes("INSERT INTO intervention_actions")
          && entry.params[3] === "DEGRADE"
          && entry.params[4] === "NEGATIVE_MARGIN_LATE_TRIAL",
      ),
    ).toBe(true);
    expect(
      db.operations.some(
        (entry) =>
          entry.sql.includes("UPDATE saas_instances SET degraded_mode = 1 WHERE id = ?")
          && entry.params[0] === "saas_1",
      ),
    ).toBe(true);
  });
});
