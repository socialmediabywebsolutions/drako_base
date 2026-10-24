import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: vi.fn(),
  ensureDatabase: vi.fn(),
  queryOne: vi.fn(),
  extractSessionFromRequest: vi.fn(),
  ensureJob: vi.fn(),
  recordCampamentoEvent: vi.fn(),
  assertFactoryQuota: vi.fn(),
  getFactoryBillingState: vi.fn(),
}));

vi.mock("@/lib/cf", () => ({
  env: mocks.env,
}));

vi.mock("@/lib/db", () => ({
  ensureDatabase: mocks.ensureDatabase,
  queryOne: mocks.queryOne,
}));

vi.mock("@/lib/edge-auth", () => ({
  extractSessionFromRequest: mocks.extractSessionFromRequest,
}));

vi.mock("@/lib/provisioning/job-runner", () => ({
  JobRunner: {
    ensureJob: mocks.ensureJob,
  },
}));

vi.mock("@/lib/empire/events", () => ({
  recordCampamentoEvent: mocks.recordCampamentoEvent,
}));

vi.mock("@/lib/billing/factory-billing", () => ({
  FactoryBillingError: class FactoryBillingError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  assertFactoryQuota: mocks.assertFactoryQuota,
  getFactoryBillingState: mocks.getFactoryBillingState,
}));

import { POST } from "@/app/api/owner/saas-factory/create-saas/route";

describe("/api/owner/saas-factory/create-saas domain plan gate", () => {
  let tenantPlan = "pro";
  let domainExists = false;

  beforeEach(() => {
    vi.clearAllMocks();
    tenantPlan = "pro";
    domainExists = false;

    mocks.ensureDatabase.mockReturnValue({});
    mocks.extractSessionFromRequest.mockResolvedValue({
      userId: "owner_1",
      email: "owner@drako.systems",
      tenantId: "tenant_a",
      role: "admin",
      iat: 1,
      exp: 9999999999,
    });
    mocks.env.mockReturnValue({
      PROVISIONING_QUEUE: { send: vi.fn() },
      DRAKO_BASE_DOMAIN: "drako.systems",
    });
    mocks.assertFactoryQuota.mockResolvedValue(undefined);
    mocks.getFactoryBillingState.mockResolvedValue({
      tenantId: "tenant_a",
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
        saasCount: 0,
        activeJobCount: 0,
        domainCount: 0,
      },
      limits: {
        saasRemaining: 5,
        jobSlotsRemaining: 3,
        domainsRemaining: 10,
      },
      eligibleToCreate: true,
    });
    mocks.ensureJob.mockResolvedValue({
      jobId: "job_1",
      created: true,
      state: "CREATED",
      entityId: "saas_1",
      payload: {},
    });
    mocks.recordCampamentoEvent.mockResolvedValue(undefined);

    mocks.queryOne.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM owners")) return { id: "owner_1" };
      if (sql.includes("SELECT saas_slug FROM tenants")) return { saas_slug: "drako" };
      if (sql.includes("SELECT plan FROM tenants")) return { plan: tenantPlan };
      if (sql.includes("FROM saas_domains")) return domainExists ? { id: "domain_1" } : null;
      return null;
    });
  });

  it("rejects free plan with DOMAIN_PLAN_NOT_ALLOWED", async () => {
    tenantPlan = "free";

    const response = await POST(
      new Request("https://drako.systems/api/owner/saas-factory/create-saas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test", slug: "test-saas" }),
      }) as any,
    );

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("DOMAIN_PLAN_NOT_ALLOWED");
    expect(mocks.ensureJob).not.toHaveBeenCalled();
  });

  it("allows pro plan and enqueues job", async () => {
    tenantPlan = "pro";

    const response = await POST(
      new Request("https://drako.systems/api/owner/saas-factory/create-saas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test", slug: "test-saas" }),
      }) as any,
    );

    expect(response.status).toBe(202);
    expect(mocks.ensureJob).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate domain with DOMAIN_ALREADY_EXISTS", async () => {
    tenantPlan = "pro";
    domainExists = true;

    const response = await POST(
      new Request("https://drako.systems/api/owner/saas-factory/create-saas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test", slug: "test-saas" }),
      }) as any,
    );

    expect(response.status).toBe(409);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("DOMAIN_ALREADY_EXISTS");
    expect(mocks.ensureJob).not.toHaveBeenCalled();
  });
});
