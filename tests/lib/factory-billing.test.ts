import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const queryOne = vi.fn();
  const getCanonicalBillingSnapshot = vi.fn();

  vi.doMock("@/lib/db", () => ({
    queryOne,
  }));

  vi.doMock("@/lib/billing/subscriptions", () => ({
    getCanonicalBillingSnapshot,
  }));

  const subject = await import("@/lib/billing/factory-billing");
  return {
    ...subject,
    queryOne,
    getCanonicalBillingSnapshot,
  };
}

describe("factory billing canonical layer", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("resolves factory billing from the tenant saas slug instead of inferring the latest tenant subscription", async () => {
    const { getFactoryBillingState, queryOne, getCanonicalBillingSnapshot } = await loadSubject();

    queryOne.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT saas_slug FROM tenants")) return { saas_slug: "drako" };
      if (sql.includes("FROM saas WHERE")) return { count: 1 };
      if (sql.includes("FROM provisioning_jobs")) return { count: 0 };
      if (sql.includes("FROM saas_domains")) return { count: 1 };
      return null;
    });
    getCanonicalBillingSnapshot.mockResolvedValue({
      tenantId: "tenant_owner",
      saasSlug: "drako",
      saasId: "saas_factory",
      subscription: {
        status: "active",
        planCode: "pro",
        currentPeriodStart: null,
        currentPeriodEnd: "2026-05-01T00:00:00.000Z",
        trial: false,
        cancelAtPeriodEnd: false,
        stripeCustomerId: "cus_factory",
        stripeSubscriptionId: "sub_factory",
        stripePriceId: "price_factory",
        updatedAt: "2026-04-03T00:00:00.000Z",
      },
      entitlements: {
        limits: { workspaces: 5 },
        features: [],
        usage: {},
      },
    });

    const state = await getFactoryBillingState("tenant_owner");

    expect(getCanonicalBillingSnapshot).toHaveBeenCalledWith({
      tenantId: "tenant_owner",
      saasSlug: "drako",
    });
    expect(
      queryOne.mock.calls.some(([sql]) => String(sql).includes("FROM saas_subscriptions")),
    ).toBe(false);
    expect(state).toEqual({
      tenantId: "tenant_owner",
      saasSlug: "drako",
      subscriptionStatus: "active",
      hasVerifiedSubscription: true,
      planCode: "pro",
      plan: "pro",
      quota: {
        plan: "pro",
        maxSaas: 5,
        maxDomains: 10,
        maxConcurrentJobs: 3,
      },
      usage: {
        saasCount: 1,
        activeJobCount: 0,
        domainCount: 1,
      },
      limits: {
        saasRemaining: 4,
        jobSlotsRemaining: 3,
        domainsRemaining: 9,
      },
      eligibleToCreate: true,
    });
  });

  it("fails closed when the canonical factory subscription is inactive", async () => {
    const { getFactoryBillingState, queryOne, getCanonicalBillingSnapshot } = await loadSubject();

    queryOne.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT saas_slug FROM tenants")) return { saas_slug: "drako" };
      if (sql.includes("FROM saas WHERE")) return { count: 0 };
      if (sql.includes("FROM provisioning_jobs")) return { count: 0 };
      if (sql.includes("FROM saas_domains")) return { count: 0 };
      return null;
    });
    getCanonicalBillingSnapshot.mockResolvedValue({
      tenantId: "tenant_owner",
      saasSlug: "drako",
      saasId: "saas_factory",
      subscription: {
        status: "canceled",
        planCode: "pro",
        currentPeriodStart: null,
        currentPeriodEnd: "2026-05-01T00:00:00.000Z",
        trial: false,
        cancelAtPeriodEnd: false,
        stripeCustomerId: "cus_factory",
        stripeSubscriptionId: "sub_factory",
        stripePriceId: "price_factory",
        updatedAt: "2026-04-03T00:00:00.000Z",
      },
      entitlements: {
        limits: { workspaces: 5 },
        features: [],
        usage: {},
      },
    });

    const state = await getFactoryBillingState("tenant_owner");

    expect(state.quota).toBeNull();
    expect(state.limits).toBeNull();
    expect(state.eligibleToCreate).toBe(false);
  });

  it("throws the right quota errors from the canonical factory state", async () => {
    const { assertFactoryQuota, queryOne, getCanonicalBillingSnapshot } = await loadSubject();

    queryOne.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT saas_slug FROM tenants")) return { saas_slug: "drako" };
      if (sql.includes("FROM saas WHERE")) return { count: 5 };
      if (sql.includes("FROM provisioning_jobs")) return { count: 3 };
      if (sql.includes("FROM saas_domains")) return { count: 1 };
      return null;
    });
    getCanonicalBillingSnapshot.mockResolvedValue({
      tenantId: "tenant_owner",
      saasSlug: "drako",
      saasId: "saas_factory",
      subscription: {
        status: "active",
        planCode: "pro",
        currentPeriodStart: null,
        currentPeriodEnd: "2026-05-01T00:00:00.000Z",
        trial: false,
        cancelAtPeriodEnd: false,
        stripeCustomerId: "cus_factory",
        stripeSubscriptionId: "sub_factory",
        stripePriceId: "price_factory",
        updatedAt: "2026-04-03T00:00:00.000Z",
      },
      entitlements: {
        limits: { workspaces: 5 },
        features: [],
        usage: {},
      },
    });

    await expect(assertFactoryQuota("tenant_owner")).rejects.toMatchObject({
      code: "SAAS_LIMIT_REACHED",
    });
  });
});
