import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureCampamentoBase: vi.fn(),
  run: vi.fn(),
  ensureJob: vi.fn(),
  acquireLock: vi.fn(),
  transitionState: vi.fn(),
  updatePayload: vi.fn(),
  completeJob: vi.fn(),
  failJob: vi.fn(),
  logRollback: vi.fn(),
  ensureStripeProductForSaas: vi.fn(),
  provisionSaasInCloudflare: vi.fn(),
  resolveSaasContext: vi.fn(),
  upsertSaasDomain: vi.fn(),
}));

vi.mock("@/lib/campamento-base", () => ({
  ensureCampamentoBase: mocks.ensureCampamentoBase,
}));

vi.mock("@/lib/db", () => ({
  run: mocks.run,
}));

vi.mock("@/lib/provisioning/job-runner", () => ({
  JobRunner: {
    ensureJob: mocks.ensureJob,
    acquireLock: mocks.acquireLock,
    transitionState: mocks.transitionState,
    updatePayload: mocks.updatePayload,
    completeJob: mocks.completeJob,
    failJob: mocks.failJob,
    logRollback: mocks.logRollback,
  },
}));

vi.mock("@/lib/campamento-base/provisioning/stripe-factory", () => ({
  ensureStripeProductForSaas: mocks.ensureStripeProductForSaas,
  archiveStripeProductAndPrices: vi.fn(),
}));

vi.mock("@/lib/campamento-base/provisioning/cloudflare-factory", () => ({
  provisionSaasInCloudflare: mocks.provisionSaasInCloudflare,
  computeDomainsForSaas: (blueprint: { proposedSlug: string }) => ({
    primaryHostname: `${blueprint.proposedSlug}.drako.systems`,
    customHostname: null,
  }),
  deleteCloudflareHostname: vi.fn(),
}));

vi.mock("@/lib/saas/repository", () => ({
  resolveSaasContext: mocks.resolveSaasContext,
  upsertSaasDomain: mocks.upsertSaasDomain,
}));

import { provisionSaaS } from "@/lib/campamento-base/saas-factory-orchestrator";

describe("saas-factory orchestrator canonical state flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureCampamentoBase.mockResolvedValue(undefined);
    mocks.run.mockResolvedValue(true);
    mocks.transitionState.mockResolvedValue(undefined);
    mocks.updatePayload.mockResolvedValue(undefined);
    mocks.completeJob.mockResolvedValue(undefined);
    mocks.failJob.mockResolvedValue(undefined);
    mocks.logRollback.mockResolvedValue(undefined);
    mocks.ensureStripeProductForSaas.mockResolvedValue({
      status: "SUCCESS",
      productId: "prod_1",
      priceIds: { monthly: "price_1" },
    });
    mocks.provisionSaasInCloudflare.mockResolvedValue({
      status: "SUCCESS",
      message: "configured",
      createdDnsRecord: "dns_1",
      createdCustomHostname: null,
    });
    mocks.resolveSaasContext.mockResolvedValue({ tenantId: "tenant_a", saasId: "saas_1", mode: "live" });
    mocks.upsertSaasDomain.mockResolvedValue({ id: "factory_domain_saas_1" });
  });

  it("transitions CREATED->RUNNING->...->SUCCESS and propagates correlation id", async () => {
    const result = await provisionSaaS({
      ownerTenantId: "tenant_a",
      blueprint: {
        ownerTenantId: "tenant_a",
        saasName: "Test SaaS",
        proposedSlug: "test-saas",
        proposedSubdomain: "test-saas",
        verticalId: "OTHER",
        summary: "summary",
        targetAudience: "audience",
        mainProblem: "problem",
        mainGoal: "goal",
        packsByDepartment: {},
        initialPricing: { currentMonthlyPrice: 10 },
        aiProfile: { tier: "BALANCED" },
      },
      preAcquiredToken: { lockVersion: 9, ownerId: "worker_1" },
      existingJob: {
        jobId: "job_1",
        entityId: "saas_1",
        state: "CREATED",
        correlationId: "corr_job_1",
        idempotencyKey: "create_saas:tenant_a:test-saas:hash",
        payload: {
          ownerTenantId: "tenant_a",
          saasName: "Test SaaS",
          proposedSlug: "test-saas",
          proposedSubdomain: "test-saas",
          verticalId: "OTHER",
          summary: "summary",
          targetAudience: "audience",
          mainProblem: "problem",
          mainGoal: "goal",
          packsByDepartment: {},
          initialPricing: { currentMonthlyPrice: 10 },
          aiProfile: { tier: "BALANCED" },
        },
      },
    });

    expect(result).toEqual({ saasId: "saas_1", status: "SUCCESS" });
    expect(mocks.transitionState).toHaveBeenNthCalledWith(1, "job_1", "RUNNING", "SAAS_REGISTERED", { lockVersion: 9, ownerId: "worker_1" }, "SaaS registered.");
    expect(mocks.transitionState).toHaveBeenNthCalledWith(2, "job_1", "SAAS_REGISTERED", "STRIPE_PRODUCT_CREATED", { lockVersion: 9, ownerId: "worker_1" }, "Stripe resources created.");
    expect(mocks.transitionState).toHaveBeenNthCalledWith(3, "job_1", "STRIPE_PRODUCT_CREATED", "DOMAINS_REGISTERED", { lockVersion: 9, ownerId: "worker_1" }, "Domain provisioning pending provider verification.");
    expect(mocks.completeJob).toHaveBeenCalledWith("job_1", "DOMAINS_REGISTERED", { lockVersion: 9, ownerId: "worker_1" });

    expect(mocks.ensureStripeProductForSaas).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: "corr_job_1", saasId: "saas_1", tenantId: "tenant_a" }),
    );
    expect(mocks.upsertSaasDomain).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "factory_domain_saas_1",
        saasId: "saas_1",
        domain: "test-saas.drako.systems",
        status: "pending",
      }),
    );
  });
});
