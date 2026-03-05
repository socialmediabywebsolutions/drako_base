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
  createDomainBinding: vi.fn(),
  verifyDomainBinding: vi.fn(),
  deleteDomainBinding: vi.fn(),
  resolveSaasContext: vi.fn(),
  upsertSaasDomain: vi.fn(),
  recordCampamentoEventSafe: vi.fn(),
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
  computeDomainsForSaas: (blueprint: { proposedSlug: string }) => ({
    primaryHostname: `${blueprint.proposedSlug}.drako.systems`,
    customHostname: null,
  }),
}));

vi.mock("@/lib/domains/domain-provider", () => ({
  createDomainBinding: mocks.createDomainBinding,
  verifyDomainBinding: mocks.verifyDomainBinding,
  deleteDomainBinding: mocks.deleteDomainBinding,
}));

vi.mock("@/lib/saas/repository", () => ({
  resolveSaasContext: mocks.resolveSaasContext,
  upsertSaasDomain: mocks.upsertSaasDomain,
}));

vi.mock("@/lib/empire/events-safe", () => ({
  recordCampamentoEventSafe: mocks.recordCampamentoEventSafe,
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
    mocks.createDomainBinding.mockResolvedValue({
      hostname: "test-saas.drako.systems",
      bindingId: "ch_1",
      providerStatus: "pending",
      alreadyExists: false,
    });
    mocks.verifyDomainBinding.mockResolvedValue({
      hostname: "test-saas.drako.systems",
      bindingId: "ch_1",
      providerStatus: "active",
    });
    mocks.deleteDomainBinding.mockResolvedValue({ deleted: true });
    mocks.resolveSaasContext.mockResolvedValue({ tenantId: "tenant_a", saasId: "saas_1", mode: "live" });
    mocks.upsertSaasDomain.mockResolvedValue({ id: "factory_domain_saas_1" });
    mocks.recordCampamentoEventSafe.mockResolvedValue({ ok: true, mode: "primary" });
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
    expect(mocks.transitionState).toHaveBeenNthCalledWith(3, "job_1", "STRIPE_PRODUCT_CREATED", "PROVISION_WORKER", { lockVersion: 9, ownerId: "worker_1" }, "Domain provisioning worker step started.");
    expect(mocks.transitionState).toHaveBeenNthCalledWith(4, "job_1", "PROVISION_WORKER", "CREATE_DOMAIN_BINDING", { lockVersion: 9, ownerId: "worker_1" }, "Domain binding created.");
    expect(mocks.transitionState).toHaveBeenNthCalledWith(5, "job_1", "CREATE_DOMAIN_BINDING", "VERIFY_DOMAIN", { lockVersion: 9, ownerId: "worker_1" }, "Domain binding verified.");
    expect(mocks.completeJob).toHaveBeenCalledWith("job_1", "VERIFY_DOMAIN", { lockVersion: 9, ownerId: "worker_1" });

    expect(mocks.ensureStripeProductForSaas).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: "corr_job_1", saasId: "saas_1", tenantId: "tenant_a" }),
    );
    expect(mocks.upsertSaasDomain).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "factory_domain_saas_1",
        saasId: "saas_1",
        domain: "test-saas.drako.systems",
        status: "active",
      }),
    );
    expect(mocks.recordCampamentoEventSafe).toHaveBeenCalled();
    const eventPayloads = mocks.recordCampamentoEventSafe.mock.calls.map((call) => call[0]);
    expect(
      eventPayloads.some(
        (payload) =>
          payload.type === "provision.saas_factory.job.succeeded" &&
          payload.correlationId === "corr_job_1" &&
          typeof payload.metadata?.durationMs === "number",
      ),
    ).toBe(true);
  });
});
