import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureCampamentoBase: vi.fn(),
  run: vi.fn(),
  transitionState: vi.fn(),
  updatePayload: vi.fn(),
  completeJob: vi.fn(),
  markDegraded: vi.fn(),
  failJob: vi.fn(),
  logRollback: vi.fn(),
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
    transitionState: mocks.transitionState,
    updatePayload: mocks.updatePayload,
    completeJob: mocks.completeJob,
    markDegraded: mocks.markDegraded,
    failJob: mocks.failJob,
    logRollback: mocks.logRollback,
    ensureJob: vi.fn(),
    acquireLock: vi.fn(),
  },
}));

vi.mock("@/lib/campamento-base/provisioning/stripe-factory", () => ({
  ensureStripeProductForSaas: vi.fn(),
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

const blueprint = {
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
} as const;

const retryEnv = {
  PROVISION_DOMAIN_VERIFY_RETRIES: "2",
  PROVISION_DOMAIN_VERIFY_BACKOFF_MS: "0",
  PROVISION_DOMAIN_VERIFY_MAX_BACKOFF_MS: "0",
  PROVISION_DOMAIN_VERIFY_JITTER_MS: "0",
  PROVISION_DOMAIN_VERIFY_TIMEOUT_MS: "1000",
} as any;

describe("provisioning domain flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureCampamentoBase.mockResolvedValue(undefined);
    mocks.run.mockResolvedValue(true);
    mocks.transitionState.mockResolvedValue(undefined);
    mocks.updatePayload.mockResolvedValue(undefined);
    mocks.completeJob.mockResolvedValue(undefined);
    mocks.markDegraded.mockResolvedValue(undefined);
    mocks.failJob.mockResolvedValue(undefined);
    mocks.logRollback.mockResolvedValue(undefined);
    mocks.resolveSaasContext.mockResolvedValue({ tenantId: "tenant_a", saasId: "saas_1", mode: "live" });
    mocks.upsertSaasDomain.mockResolvedValue({ id: "factory_domain_saas_1" });
    mocks.recordCampamentoEventSafe.mockResolvedValue({ ok: true, mode: "primary" });
    mocks.deleteDomainBinding.mockResolvedValue({ deleted: true });
  });

  it("retries domain verify failures and eventually succeeds", async () => {
    mocks.createDomainBinding.mockResolvedValue({
      hostname: "test-saas.drako.systems",
      bindingId: "ch_1",
      providerStatus: "pending",
      alreadyExists: false,
    });
    mocks.verifyDomainBinding
      .mockRejectedValueOnce(new Error("DOMAIN_VERIFY_TIMEOUT"))
      .mockRejectedValueOnce(new Error("DOMAIN_VERIFY_TIMEOUT"))
      .mockResolvedValueOnce({
        hostname: "test-saas.drako.systems",
        bindingId: "ch_1",
        providerStatus: "active",
      });

    const result = await provisionSaaS({
      env: retryEnv,
      ownerTenantId: "tenant_a",
      blueprint: { ...blueprint },
      preAcquiredToken: { lockVersion: 7, ownerId: "worker_1" },
      existingJob: {
        jobId: "job_1",
        entityId: "saas_1",
        state: "STRIPE_PRODUCT_CREATED",
        correlationId: "corr_1",
        idempotencyKey: "idem_1",
        payload: { ...blueprint },
      },
    });

    expect(result.status).toBe("SUCCESS");
    expect(mocks.verifyDomainBinding).toHaveBeenCalledTimes(3);
    const eventTypes = mocks.recordCampamentoEventSafe.mock.calls.map((call) => call[0]?.type);
    expect(eventTypes.filter((eventType) => eventType === "provision.domain.verify.retrying")).toHaveLength(2);
    expect(eventTypes).toContain("provision.domain.verify.succeeded");
    expect(mocks.completeJob).toHaveBeenCalledWith("job_1", "VERIFY_DOMAIN", { lockVersion: 7, ownerId: "worker_1" });
  });

  it("fails when domain provider create throws error", async () => {
    mocks.createDomainBinding.mockRejectedValue(new Error("DOMAIN_PROVIDER_MISCONFIGURED"));

    const result = await provisionSaaS({
      ownerTenantId: "tenant_a",
      blueprint: { ...blueprint },
      preAcquiredToken: { lockVersion: 7, ownerId: "worker_1" },
      existingJob: {
        jobId: "job_1",
        entityId: "saas_1",
        state: "STRIPE_PRODUCT_CREATED",
        correlationId: "corr_2",
        idempotencyKey: "idem_2",
        payload: { ...blueprint },
      },
    });

    expect(result.status).toBe("FAILED");
    expect(mocks.failJob).toHaveBeenCalled();
  });

  it("fails verify after exhausting retries and emits provision.domain.verify.failed event", async () => {
    mocks.createDomainBinding.mockResolvedValue({
      hostname: "test-saas.drako.systems",
      bindingId: "ch_1",
      providerStatus: "pending",
      alreadyExists: false,
    });
    mocks.verifyDomainBinding.mockRejectedValue(new Error("DOMAIN_VERIFY_TIMEOUT"));

    const result = await provisionSaaS({
      env: retryEnv,
      ownerTenantId: "tenant_a",
      blueprint: { ...blueprint },
      preAcquiredToken: { lockVersion: 7, ownerId: "worker_1" },
      existingJob: {
        jobId: "job_1",
        entityId: "saas_1",
        state: "STRIPE_PRODUCT_CREATED",
        correlationId: "corr_3",
        idempotencyKey: "idem_3",
        payload: { ...blueprint },
      },
    });

    expect(result.status).toBe("FAILED");
    expect(mocks.verifyDomainBinding).toHaveBeenCalledTimes(3);
    const eventTypes = mocks.recordCampamentoEventSafe.mock.calls.map((call) => call[0]?.type);
    expect(eventTypes).toContain("provision.domain.verify.failed");
  });

  it("marks job degraded when verify remains pending after retries", async () => {
    mocks.createDomainBinding.mockResolvedValue({
      hostname: "test-saas.drako.systems",
      bindingId: "ch_1",
      providerStatus: "pending",
      alreadyExists: false,
    });
    mocks.verifyDomainBinding.mockResolvedValue({
      hostname: "test-saas.drako.systems",
      bindingId: "ch_1",
      providerStatus: "pending",
    });

    const result = await provisionSaaS({
      env: retryEnv,
      ownerTenantId: "tenant_a",
      blueprint: { ...blueprint },
      preAcquiredToken: { lockVersion: 7, ownerId: "worker_1" },
      existingJob: {
        jobId: "job_1",
        entityId: "saas_1",
        state: "STRIPE_PRODUCT_CREATED",
        correlationId: "corr_4",
        idempotencyKey: "idem_4",
        payload: { ...blueprint },
      },
    });

    expect(result.status).toBe("DEGRADED");
    expect(mocks.failJob).not.toHaveBeenCalled();
    expect(mocks.markDegraded).toHaveBeenCalledWith(
      "job_1",
      "VERIFY_DOMAIN",
      { lockVersion: 7, ownerId: "worker_1" },
      expect.stringContaining("pending"),
    );
    expect(mocks.deleteDomainBinding).not.toHaveBeenCalled();
    expect(mocks.upsertSaasDomain).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "pending" }),
    );
    const eventTypes = mocks.recordCampamentoEventSafe.mock.calls.map((call) => call[0]?.type);
    expect(eventTypes).toContain("provision.domain.degraded");
  });
});
