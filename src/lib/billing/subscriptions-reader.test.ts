import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  run: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  queryOne: mocks.queryOne,
  queryAll: mocks.queryAll,
  run: mocks.run,
}));

import { getCanonicalBillingEntitlements, getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";

type QueryOneResponse = Record<string, unknown> | null;
type QueryAllResponse = Record<string, unknown>[];

function setupSnapshotDb(input: {
  subscription?: QueryOneResponse | Error | null;
  subscriptionFallback?: QueryOneResponse | null;
  saasInstance?: QueryOneResponse | Error | null;
  saas?: QueryOneResponse | Error | null;
  quotas?: QueryAllResponse;
  features?: QueryAllResponse | Error;
}) {
  mocks.queryOne.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM saas_subscriptions")) {
      if (sql.includes("current_period_start")) {
        if (input.subscription instanceof Error) throw input.subscription;
        return input.subscription ?? null;
      }
      return input.subscriptionFallback ?? null;
    }
    if (sql.includes("FROM saas_instances")) {
      if (input.saasInstance instanceof Error) throw input.saasInstance;
      return input.saasInstance ?? null;
    }
    if (sql.includes("FROM saas\n")) {
      if (input.saas instanceof Error) throw input.saas;
      return input.saas ?? null;
    }
    return null;
  });

  mocks.queryAll.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM saas_usage_quotas")) {
      return input.quotas ?? [];
    }
    if (sql.includes("FROM saas_features")) {
      if (input.features instanceof Error) throw input.features;
      return input.features ?? [];
    }
    return [];
  });
}

describe("getCanonicalBillingSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty canonical snapshot for tenant without subscription", async () => {
    setupSnapshotDb({
      subscription: null,
      saasInstance: null,
      saas: null,
      quotas: [],
      features: [],
    });

    const snapshot = await getCanonicalBillingSnapshot({ tenantId: "tenant_1", saasSlug: "mentoria" });

    expect(snapshot).toEqual({
      tenantId: "tenant_1",
      saasSlug: "mentoria",
      saasId: null,
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
  });

  it.each([
    ["active", false],
    ["trial", true],
    ["trialing", true],
    ["past_due", false],
    ["canceled", false],
  ] satisfies Array<[string, boolean]>)("maps subscription status %s into canonical snapshot", async (status, expectedTrial) => {
    setupSnapshotDb({
      subscription: {
        tenant_id: "tenant_1",
        saas_slug: "socialflow",
        stripe_customer_id: "cus_1",
        stripe_subscription_id: "sub_1",
        stripe_price_id: "price_1",
        plan_code: "pro",
        status,
        current_period_start: "2026-04-01T00:00:00.000Z",
        current_period_end: "2026-05-01T00:00:00.000Z",
        cancel_at_period_end: 0,
        updated_at: "2026-04-03T00:00:00.000Z",
      },
      saasInstance: { id: "instance_sf" },
      quotas: [],
      features: [],
    });

    const snapshot = await getCanonicalBillingSnapshot({ tenantId: "tenant_1", saasSlug: "socialflow" });

    expect(snapshot.subscription.status).toBe(status);
    expect(snapshot.subscription.trial).toBe(expectedTrial);
    expect(snapshot.subscription.planCode).toBe("pro");
    expect(snapshot.saasId).toBe("instance_sf");
  });

  it("includes limits, usage and enabled features when present", async () => {
    setupSnapshotDb({
      subscription: {
        tenant_id: "tenant_1",
        saas_slug: "drako",
        stripe_customer_id: "cus_1",
        stripe_subscription_id: "sub_1",
        stripe_price_id: "price_1",
        plan_code: "drako_base_pro",
        status: "active",
        current_period_start: "2026-04-01T00:00:00.000Z",
        current_period_end: "2026-05-01T00:00:00.000Z",
        cancel_at_period_end: 1,
        updated_at: "2026-04-03T00:00:00.000Z",
      },
      saasInstance: new Error("no such table: saas_instances"),
      saas: { id: "saas_drako" },
      quotas: [
        { quota_key: "ai_calls", limit_value: 1000, current_value: 25 },
        { quota_key: "workspaces", limit_value: "5", current_value: "2" },
      ],
      features: [
        { feature_key: "SOCIAL" },
        { feature_key: "OWNER_CONTROL" },
      ],
    });

    const snapshot = await getCanonicalBillingSnapshot({ tenantId: "tenant_1", saasSlug: "drako" });

    expect(snapshot.subscription.planCode).toBe("pro");
    expect(snapshot.subscription.cancelAtPeriodEnd).toBe(true);
    expect(snapshot.entitlements.limits).toEqual({ ai_calls: 1000, workspaces: 5 });
    expect(snapshot.entitlements.usage).toEqual({ ai_calls: 25, workspaces: 2 });
    expect(snapshot.entitlements.features).toEqual(["SOCIAL", "OWNER_CONTROL"]);
    expect(snapshot.saasId).toBe("saas_drako");
  });

  it("remains compatible when optional subscription columns are missing", async () => {
    setupSnapshotDb({
      subscription: new Error("no such column: current_period_start"),
      subscriptionFallback: {
        tenant_id: "tenant_1",
        saas_slug: "mentoria",
        stripe_customer_id: "cus_1",
        stripe_subscription_id: "sub_1",
        stripe_price_id: "price_1",
        plan_code: "family",
        status: "trialing",
        current_period_end: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-04-03T00:00:00.000Z",
      },
      saasInstance: { id: "mentoria_instance" },
      quotas: [{ quota_key: "guidedSessionsPerDay", limit_value: 60, current_value: 4 }],
      features: new Error("no such table: saas_features"),
    });

    const snapshot = await getCanonicalBillingSnapshot({ tenantId: "tenant_1", saasSlug: "mentoria" });

    expect(snapshot.subscription.currentPeriodStart).toBeNull();
    expect(snapshot.subscription.cancelAtPeriodEnd).toBeNull();
    expect(snapshot.subscription.currentPeriodEnd).toBe("2026-05-01T00:00:00.000Z");
    expect(snapshot.subscription.trial).toBe(true);
    expect(snapshot.entitlements.features).toEqual([]);
  });

  it("prefers saas_instances over saas when both tables are live", async () => {
    setupSnapshotDb({
      subscription: {
        tenant_id: "tenant_1",
        saas_slug: "socialflow",
        stripe_customer_id: "cus_1",
        stripe_subscription_id: "sub_1",
        stripe_price_id: "price_1",
        plan_code: "pro",
        status: "active",
        current_period_start: "2026-04-01T00:00:00.000Z",
        current_period_end: "2026-05-01T00:00:00.000Z",
        cancel_at_period_end: 0,
        updated_at: "2026-04-03T00:00:00.000Z",
      },
      saasInstance: { id: "instance_preferred" },
      saas: { id: "saas_fallback" },
      quotas: [],
      features: [],
    });

    const snapshot = await getCanonicalBillingSnapshot({ tenantId: "tenant_1", saasSlug: "socialflow" });

    expect(snapshot.saasId).toBe("instance_preferred");
  });
});

describe("getCanonicalBillingEntitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the historical shape stable when no verified subscription exists", async () => {
    setupSnapshotDb({
      subscription: null,
      saasInstance: null,
      saas: null,
      quotas: [],
      features: [],
    });

    const entitlements = await getCanonicalBillingEntitlements({ tenantId: "tenant_1", saasSlug: "mentoria" });

    expect(entitlements).toEqual({
      tenantId: "tenant_1",
      saasSlug: "mentoria",
      saasId: null,
      subscriptionStatus: null,
      hasVerifiedSubscription: false,
      limits: {},
      features: [],
      usage: {},
    });
  });

  it.each([
    ["active", false],
    ["trial", true],
    ["trialing", true],
  ] satisfies Array<[string, boolean]>)(
    "exposes limits, features and usage for status %s without breaking compatibility",
    async (status, expectedTrial) => {
      setupSnapshotDb({
        subscription: {
          tenant_id: "tenant_1",
          saas_slug: "socialflow",
          stripe_customer_id: "cus_1",
          stripe_subscription_id: "sub_1",
          stripe_price_id: "price_1",
          plan_code: "pro",
          status,
          current_period_start: "2026-04-01T00:00:00.000Z",
          current_period_end: "2026-05-01T00:00:00.000Z",
          cancel_at_period_end: 0,
          updated_at: "2026-04-03T00:00:00.000Z",
        },
        saasInstance: { id: "instance_sf" },
        saas: { id: "saas_fallback" },
        quotas: [{ quota_key: "ai_calls", limit_value: "1000", current_value: "25" }],
        features: [{ feature_key: "PUBLISHING" }],
      });

      const entitlements = await getCanonicalBillingEntitlements({ tenantId: "tenant_1", saasSlug: "socialflow" });
      const snapshot = await getCanonicalBillingSnapshot({ tenantId: "tenant_1", saasSlug: "socialflow" });

      expect(entitlements).toEqual({
        tenantId: "tenant_1",
        saasSlug: "socialflow",
        saasId: "instance_sf",
        subscriptionStatus: status,
        hasVerifiedSubscription: true,
        limits: { ai_calls: 1000 },
        features: ["PUBLISHING"],
        usage: { ai_calls: 25 },
      });
      expect(snapshot.subscription.trial).toBe(expectedTrial);
    },
  );

  it("remains compatible when optional columns are missing and feature materialization is unavailable", async () => {
    setupSnapshotDb({
      subscription: new Error("no such column: current_period_start"),
      subscriptionFallback: {
        tenant_id: "tenant_1",
        saas_slug: "mentoria",
        stripe_customer_id: "cus_1",
        stripe_subscription_id: "sub_1",
        stripe_price_id: "price_1",
        plan_code: "family",
        status: "past_due",
        current_period_end: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-04-03T00:00:00.000Z",
      },
      saasInstance: new Error("no such table: saas_instances"),
      saas: { id: "saas_mentoria" },
      quotas: [{ quota_key: "guidedSessionsPerDay", limit_value: 60, current_value: 4 }],
      features: new Error("no such table: saas_features"),
    });

    const entitlements = await getCanonicalBillingEntitlements({ tenantId: "tenant_1", saasSlug: "mentoria" });

    expect(entitlements).toEqual({
      tenantId: "tenant_1",
      saasSlug: "mentoria",
      saasId: "saas_mentoria",
      subscriptionStatus: "past_due",
      hasVerifiedSubscription: true,
      limits: { guidedSessionsPerDay: 60 },
      features: [],
      usage: { guidedSessionsPerDay: 4 },
    });
  });
});
