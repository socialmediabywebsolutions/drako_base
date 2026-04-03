import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const queryOne = vi.fn();
  const getFactoryBillingState = vi.fn();

  vi.doMock("@/lib/db", () => ({
    queryOne,
  }));

  vi.doMock("@/lib/billing/factory-billing", () => ({
    getFactoryBillingState,
  }));

  const { getFactoryStatus } = await import("@/lib/factory/status");

  return {
    getFactoryStatus,
    queryOne,
    getFactoryBillingState,
  };
}

describe("getFactoryStatus", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("aggregates jobs, domains, quota, usage and limits", async () => {
    const { getFactoryStatus, queryOne, getFactoryBillingState } = await loadSubject();

    queryOne.mockImplementation(async (sql: string) => {
      if (sql.includes("current_state = 'CREATED'")) return { count: 1 };
      if (sql.includes("current_state = 'RUNNING'")) return { count: 1 };
      if (sql.includes("current_state = 'DEGRADED'")) return { count: 1 };
      if (sql.includes("current_state = 'FAILED'")) return { count: 0 };
      if (sql.includes("current_state = 'SUCCESS'")) return { count: 12 };
      if (sql.includes("lower(status) = 'pending'")) return { count: 1 };
      if (sql.includes("lower(status) = 'provisioning'")) return { count: 0 };
      if (sql.includes("lower(status) = 'active'")) return { count: 4 };
      if (sql.includes("lower(status) = 'failed'")) return { count: 0 };
      if (sql.includes("FROM saas_domains WHERE tenant_id = ?")) return { count: 5 };
      return { count: 0 };
    });
    getFactoryBillingState.mockResolvedValue({
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
        saasCount: 4,
        activeJobCount: 2,
        domainCount: 5,
      },
      limits: {
        saasRemaining: 1,
        jobSlotsRemaining: 1,
        domainsRemaining: 5,
      },
      eligibleToCreate: true,
    });

    const status = await getFactoryStatus("tenant_owner");

    expect(status).toEqual({
      activeSaas: 4,
      jobs: {
        created: 1,
        running: 1,
        degraded: 1,
        failed: 0,
        succeeded: 12,
      },
      domains: {
        pending: 1,
        provisioning: 0,
        active: 4,
        failed: 0,
      },
      quota: {
        plan: "pro",
        maxSaas: 5,
        maxDomains: 10,
        maxConcurrentJobs: 3,
      },
      usage: {
        saasCount: 4,
        activeJobCount: 2,
        domainCount: 5,
      },
      limits: {
        saasRemaining: 1,
        jobSlotsRemaining: 1,
        domainsRemaining: 5,
      },
      slo: {
        degraded: true,
        failing: false,
      },
    });
  });

  it("returns null remaining values for infinity quotas", async () => {
    const { getFactoryStatus, queryOne, getFactoryBillingState } = await loadSubject();

    queryOne.mockImplementation(async (sql: string) => {
      if (sql.includes("current_state = 'CREATED'")) return { count: 2 };
      if (sql.includes("current_state = 'RUNNING'")) return { count: 1 };
      if (sql.includes("current_state = 'DEGRADED'")) return { count: 0 };
      if (sql.includes("current_state = 'FAILED'")) return { count: 1 };
      if (sql.includes("current_state = 'SUCCESS'")) return { count: 20 };
      if (sql.includes("lower(status) = 'pending'")) return { count: 0 };
      if (sql.includes("lower(status) = 'provisioning'")) return { count: 1 };
      if (sql.includes("lower(status) = 'active'")) return { count: 8 };
      if (sql.includes("lower(status) = 'failed'")) return { count: 2 };
      if (sql.includes("FROM saas_domains WHERE tenant_id = ?")) return { count: 11 };
      return { count: 0 };
    });
    getFactoryBillingState.mockResolvedValue({
      tenantId: "tenant_enterprise",
      saasSlug: "drako",
      subscriptionStatus: "active",
      hasVerifiedSubscription: true,
      planCode: "enterprise",
      plan: "enterprise",
      quota: {
        plan: "enterprise",
        maxSaas: Number.POSITIVE_INFINITY,
        maxDomains: Number.POSITIVE_INFINITY,
        maxConcurrentJobs: 10,
      },
      usage: {
        saasCount: 8,
        activeJobCount: 3,
        domainCount: 11,
      },
      limits: {
        saasRemaining: null,
        jobSlotsRemaining: 7,
        domainsRemaining: null,
      },
      eligibleToCreate: true,
    });

    const status = await getFactoryStatus("tenant_enterprise");

    expect(status.quota).toEqual({
      plan: "enterprise",
      maxSaas: Number.POSITIVE_INFINITY,
      maxDomains: Number.POSITIVE_INFINITY,
      maxConcurrentJobs: 10,
    });
    expect(status.limits).toEqual({
      saasRemaining: null,
      jobSlotsRemaining: 7,
      domainsRemaining: null,
    });
    expect(status.slo).toEqual({
      degraded: false,
      failing: true,
    });
    expect(status.domains.failed).toBe(2);
  });

  it("omits quota and limits when no active plan can be resolved", async () => {
    const { getFactoryStatus, queryOne, getFactoryBillingState } = await loadSubject();

    queryOne.mockResolvedValue({ count: 0 });
    getFactoryBillingState.mockResolvedValue({
      tenantId: "tenant_inactive",
      saasSlug: "drako",
      subscriptionStatus: "canceled",
      hasVerifiedSubscription: false,
      planCode: "pro",
      plan: "pro",
      quota: null,
      usage: {
        saasCount: 0,
        activeJobCount: 0,
        domainCount: 0,
      },
      limits: null,
      eligibleToCreate: false,
    });

    const status = await getFactoryStatus("tenant_inactive");

    expect(status.quota).toBeUndefined();
    expect(status.limits).toBeUndefined();
    expect(status.usage).toEqual({
      saasCount: 0,
      activeJobCount: 0,
      domainCount: 0,
    });
  });
});
