import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: vi.fn(),
  ensureDatabase: vi.fn(),
  queryOne: vi.fn(),
  extractSessionFromRequest: vi.fn(),
  ensureJob: vi.fn(),
  recordCampamentoEvent: vi.fn(),
  assertFactoryQuota: vi.fn(),
  getCanonicalBillingEntitlements: vi.fn(),
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

vi.mock("@/lib/billing/factory-entitlements", () => ({
  FactoryBillingError: class FactoryBillingError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  assertFactoryQuota: mocks.assertFactoryQuota,
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  getCanonicalBillingEntitlements: mocks.getCanonicalBillingEntitlements,
}));

import { POST } from "@/app/api/owner/saas-factory/create-saas/route";

describe("/api/owner/saas-factory/create-saas canonical flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureDatabase.mockReturnValue({});
    mocks.extractSessionFromRequest.mockResolvedValue({
      userId: "user_owner",
      email: "owner@drako.systems",
      tenantId: "tenant_a",
      role: "admin",
      iat: 1,
      exp: 9999999999,
    });
    mocks.queryOne.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM owners")) return { id: "owner_1" };
      if (sql.includes("FROM tenants")) return { saas_slug: "drako" };
      return null;
    });
    mocks.env.mockReturnValue({
      PROVISIONING_QUEUE: { send: vi.fn() },
    });
    mocks.assertFactoryQuota.mockResolvedValue(undefined);
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_a",
      saasSlug: "drako",
      subscriptionStatus: "active",
      hasVerifiedSubscription: true,
      limits: { workspaces: 5 },
    });
    mocks.ensureJob.mockResolvedValue({
      jobId: "job_create_saas_tenant_a_test",
      created: true,
      state: "CREATED",
      entityId: "saas_1",
      payload: {},
    });
    mocks.recordCampamentoEvent.mockResolvedValue(undefined);
  });

  it("fails closed when session is missing", async () => {
    mocks.extractSessionFromRequest.mockResolvedValue(null);

    const response = await POST(
      new Request("https://drako.systems/api/owner/saas-factory/create-saas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test SaaS", slug: "test-saas" }),
      }) as any,
    );

    expect(response.status).toBe(401);
    expect(mocks.ensureJob).not.toHaveBeenCalled();
  });

  it("fails closed when role is not owner-level", async () => {
    mocks.extractSessionFromRequest.mockResolvedValue({
      userId: "user_regular",
      email: "user@drako.systems",
      tenantId: "tenant_a",
      role: "user",
      iat: 1,
      exp: 9999999999,
    });

    const response = await POST(
      new Request("https://drako.systems/api/owner/saas-factory/create-saas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test SaaS", slug: "test-saas" }),
      }) as any,
    );

    expect(response.status).toBe(403);
    expect(mocks.ensureJob).not.toHaveBeenCalled();
  });

  it("returns 403 when tenant plan is missing for SaaS factory", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_a",
      saasSlug: "drako",
      subscriptionStatus: null,
      hasVerifiedSubscription: false,
      limits: {},
    });

    const response = await POST(
      new Request("https://drako.systems/api/owner/saas-factory/create-saas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test SaaS", slug: "test-saas" }),
      }) as any,
    );

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("PLAN_REQUIRED");
    expect(mocks.ensureJob).not.toHaveBeenCalled();
  });

  it("returns 403 when workspace limit is exhausted even with verified subscription", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_a",
      saasSlug: "drako",
      subscriptionStatus: "active",
      hasVerifiedSubscription: true,
      limits: { workspaces: 0 },
    });

    const response = await POST(
      new Request("https://drako.systems/api/owner/saas-factory/create-saas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test SaaS", slug: "test-saas" }),
      }) as any,
    );

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("PLAN_REQUIRED");
    expect(mocks.ensureJob).not.toHaveBeenCalled();
  });

  it("queues canonical provisioning job with idempotent contract", async () => {
    const response = await POST(
      new Request("https://drako.systems/api/owner/saas-factory/create-saas", {
        method: "POST",
        headers: { "content-type": "application/json", "x-correlation-id": "corr_test_1234" },
        body: JSON.stringify({ name: "Test SaaS", slug: "test-saas", idempotencyKey: "idem_test_saas" }),
      }) as any,
    );

    expect(response.status).toBe(202);
    const payload = await response.json() as { canonical: boolean; queued: boolean; correlationId: string };
    expect(payload.canonical).toBe(true);
    expect(payload.queued).toBe(true);
    expect(payload.correlationId).toBe("corr_test_1234");
    expect(mocks.ensureJob).toHaveBeenCalledTimes(1);
    expect(mocks.recordCampamentoEvent).toHaveBeenCalledTimes(1);
  });

  it("is idempotent across repeated requests with same payload", async () => {
    mocks.ensureJob
      .mockResolvedValueOnce({
        jobId: "job_create_saas_tenant_a_test",
        created: true,
        state: "CREATED",
        entityId: "saas_1",
        payload: {},
      })
      .mockResolvedValueOnce({
        jobId: "job_create_saas_tenant_a_test",
        created: false,
        state: "RUNNING",
        entityId: "saas_1",
        payload: {},
      });

    const buildRequest = () => new Request("https://drako.systems/api/owner/saas-factory/create-saas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Test SaaS", slug: "test-saas" }),
    }) as any;

    const first = await POST(buildRequest());
    const second = await POST(buildRequest());

    expect(first.status).toBe(202);
    expect(second.status).toBe(200);
    expect(mocks.ensureJob).toHaveBeenCalledTimes(2);
  });
});
