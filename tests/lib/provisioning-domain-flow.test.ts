import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureCampamentoBase: vi.fn(),
  run: vi.fn(),
  queryOne: vi.fn(),
  queryAll: vi.fn(),
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
  queryOne: mocks.queryOne,
  queryAll: mocks.queryAll,
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
    const runtimeSnapshot = {
      saasStatus: "inactive",
      saasDomainStatus: null as string | null,
      saasDomain: null as string | null,
      saasPublicDomain: null as string | null,
      instanceStatus: "inactive",
      instancePlanTier: "trial",
      instanceTrialDomain: null as string | null,
      instanceCustomDomain: null as string | null,
      instanceDomainStatus: null as string | null,
      runtimeContractStatus: null as string | null,
      provisioningStatus: null as string | null,
      provisioningPlan: null as string | null,
      provisioningLastError: null as string | null,
      brandingSettingsId: null as string | null,
      featureKeys: [] as string[],
    };
    mocks.run.mockImplementation(async (sql: string, ...params: unknown[]) => {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
      if (normalized.startsWith("update saas set status = 'provisioning'")) {
        runtimeSnapshot.saasStatus = "provisioning";
        runtimeSnapshot.saasDomainStatus = "pending";
        runtimeSnapshot.saasDomain = String(params[0]);
        runtimeSnapshot.saasPublicDomain = String(params[2]);
      }
      if (normalized.startsWith("update saas_instances set status = 'provisioning'")) {
        runtimeSnapshot.instanceStatus = "provisioning";
        runtimeSnapshot.instanceTrialDomain = String(params[0]);
        runtimeSnapshot.instanceCustomDomain = params[1] ? String(params[1]) : null;
        runtimeSnapshot.instanceDomainStatus = "pending";
      }
      if (normalized.startsWith("insert into campamento_provisioning")) {
        runtimeSnapshot.provisioningStatus = String(params[4]);
        runtimeSnapshot.provisioningPlan = String(params[5]);
        runtimeSnapshot.provisioningLastError = params[6] ? String(params[6]) : null;
        const plan = JSON.parse(String(params[5])) as { runtime?: { status?: string } };
        runtimeSnapshot.runtimeContractStatus = plan.runtime?.status ?? String(params[4]);
      }
      if (normalized.startsWith("update saas set status = ?")) {
        runtimeSnapshot.saasStatus = String(params[0]);
        runtimeSnapshot.saasDomain = String(params[1]);
        runtimeSnapshot.saasPublicDomain = String(params[2]);
        runtimeSnapshot.saasDomainStatus = String(params[3]);
      }
      if (normalized.startsWith("update saas_instances set status = ?")) {
        runtimeSnapshot.instanceStatus = String(params[0]);
        runtimeSnapshot.instanceTrialDomain = String(params[1]);
        runtimeSnapshot.instanceCustomDomain = params[2] ? String(params[2]) : null;
        runtimeSnapshot.instanceDomainStatus = String(params[3]);
      }
      if (normalized.startsWith("insert into saas_branding_settings")) {
        runtimeSnapshot.brandingSettingsId = String(params[0]);
      }
      if (normalized.startsWith("delete from saas_branding_settings where tenant_id = ? and saas_id = ?")) {
        runtimeSnapshot.brandingSettingsId = null;
      }
      if (normalized.startsWith("insert into saas_features")) {
        runtimeSnapshot.featureKeys = [...new Set([...runtimeSnapshot.featureKeys, String(params[3])])].sort();
      }
      if (normalized.startsWith("delete from saas_features where tenant_id = ? and saas_id = ?")) {
        runtimeSnapshot.featureKeys = [];
      }
      return true;
    });
    mocks.queryOne.mockImplementation(async (sql: string) => {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
      if (normalized.includes("select status, plan, last_error from campamento_provisioning")) {
        return {
          status: runtimeSnapshot.provisioningStatus,
          plan: runtimeSnapshot.provisioningPlan,
          last_error: runtimeSnapshot.provisioningLastError,
        };
      }
      if (normalized.includes("from saas where id = ? and tenant_id = ?")) {
        return {
          status: runtimeSnapshot.saasStatus,
          domain_status: runtimeSnapshot.saasDomainStatus,
          domain: runtimeSnapshot.saasDomain,
          public_domain: runtimeSnapshot.saasPublicDomain,
        };
      }
      if (normalized.includes("from saas_instances where id = ? and tenant_id = ?")) {
        return {
          status: runtimeSnapshot.instanceStatus,
          plan_tier: runtimeSnapshot.instancePlanTier,
          trial_domain: runtimeSnapshot.instanceTrialDomain,
          custom_domain: runtimeSnapshot.instanceCustomDomain,
          domain_status: runtimeSnapshot.instanceDomainStatus,
        };
      }
      if (normalized.includes("from saas_branding_settings where tenant_id = ? and saas_id = ?")) {
        return { id: runtimeSnapshot.brandingSettingsId };
      }
      return null;
    });
    mocks.queryAll.mockImplementation(async (sql: string) => {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
      if (normalized.includes("from saas_features")) {
        return runtimeSnapshot.featureKeys.map((featureKey) => ({ feature_key: featureKey, status: "ENABLED" }));
      }
      return [];
    });
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
    expect(mocks.completeJob).toHaveBeenCalledWith("job_1", "BOOTSTRAP_READY", { lockVersion: 7, ownerId: "worker_1" });
    expect(mocks.updatePayload).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({
        runtimeDeployment: expect.objectContaining({ status: "active", activationReady: true }),
      }),
      { lockVersion: 7, ownerId: "worker_1" },
    );
    expect(mocks.updatePayload).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({
        bootstrapDeployment: expect.objectContaining({ status: "ready", readinessMarker: "bootstrap_ready" }),
      }),
      { lockVersion: 7, ownerId: "worker_1" },
    );
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
    expect(mocks.updatePayload).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({
        runtimeDeployment: expect.objectContaining({ status: "degraded", activationReady: false }),
      }),
      { lockVersion: 7, ownerId: "worker_1" },
    );
    expect(mocks.deleteDomainBinding).not.toHaveBeenCalled();
    expect(mocks.upsertSaasDomain).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "pending" }),
    );
    const eventTypes = mocks.recordCampamentoEventSafe.mock.calls.map((call) => call[0]?.type);
    expect(eventTypes).toContain("provision.domain.degraded");
  });

  it("marks job degraded when bootstrap is partial after activation is valid", async () => {
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

    const result = await provisionSaaS({
      env: { ...retryEnv, PROVISIONING_FAULT_AT: "BOOTSTRAP_PARTIAL_READY" },
      ownerTenantId: "tenant_a",
      blueprint: { ...blueprint },
      preAcquiredToken: { lockVersion: 7, ownerId: "worker_1" },
      existingJob: {
        jobId: "job_1",
        entityId: "saas_1",
        state: "STRIPE_PRODUCT_CREATED",
        correlationId: "corr_5",
        idempotencyKey: "idem_5",
        payload: { ...blueprint },
      },
    });

    expect(result.status).toBe("DEGRADED");
    expect(mocks.markDegraded).toHaveBeenCalledWith(
      "job_1",
      "BOOTSTRAP_READY",
      { lockVersion: 7, ownerId: "worker_1" },
      expect.stringContaining("BOOTSTRAP_FEATURE_BASELINE_PARTIAL"),
    );
    expect(mocks.updatePayload).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({
        bootstrapDeployment: expect.objectContaining({ status: "degraded", readinessMarker: "bootstrap_partial" }),
      }),
      { lockVersion: 7, ownerId: "worker_1" },
    );
  });

  it("fails when bootstrap consistency breaks after activation", async () => {
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

    const result = await provisionSaaS({
      env: { ...retryEnv, PROVISIONING_FAULT_AT: "BOOTSTRAP_CONSISTENCY_BREAK" },
      ownerTenantId: "tenant_a",
      blueprint: { ...blueprint },
      preAcquiredToken: { lockVersion: 7, ownerId: "worker_1" },
      existingJob: {
        jobId: "job_1",
        entityId: "saas_1",
        state: "STRIPE_PRODUCT_CREATED",
        correlationId: "corr_6",
        idempotencyKey: "idem_6",
        payload: { ...blueprint },
      },
    });

    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("CANONICAL_BOOTSTRAP_NOT_READY");
    expect(mocks.failJob).toHaveBeenCalled();
    expect(mocks.logRollback).toHaveBeenCalledWith("job_1", "BOOTSTRAP", expect.stringContaining("Deleted bootstrap"));
  });
});
