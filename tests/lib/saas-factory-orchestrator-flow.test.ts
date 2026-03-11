import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureCampamentoBase: vi.fn(),
  run: vi.fn(),
  queryOne: vi.fn(),
  queryAll: vi.fn(),
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
  queryOne: mocks.queryOne,
  queryAll: mocks.queryAll,
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
      if (normalized.startsWith("insert into saas_features")) {
        runtimeSnapshot.featureKeys = [...new Set([...runtimeSnapshot.featureKeys, String(params[3])])].sort();
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
    expect(mocks.transitionState).toHaveBeenNthCalledWith(3, "job_1", "STRIPE_PRODUCT_CREATED", "RUNTIME_DEPLOYED", { lockVersion: 9, ownerId: "worker_1" }, "Canonical runtime deployment recorded.");
    expect(mocks.transitionState).toHaveBeenNthCalledWith(4, "job_1", "RUNTIME_DEPLOYED", "PROVISION_WORKER", { lockVersion: 9, ownerId: "worker_1" }, "Domain provisioning worker step started.");
    expect(mocks.transitionState).toHaveBeenNthCalledWith(5, "job_1", "PROVISION_WORKER", "CREATE_DOMAIN_BINDING", { lockVersion: 9, ownerId: "worker_1" }, "Domain binding created.");
    expect(mocks.transitionState).toHaveBeenNthCalledWith(6, "job_1", "CREATE_DOMAIN_BINDING", "VERIFY_DOMAIN", { lockVersion: 9, ownerId: "worker_1" }, "Domain binding verified.");
    expect(mocks.transitionState).toHaveBeenNthCalledWith(7, "job_1", "VERIFY_DOMAIN", "BOOTSTRAP_READY", { lockVersion: 9, ownerId: "worker_1" }, "Canonical bootstrap completed.");
    expect(mocks.completeJob).toHaveBeenCalledWith("job_1", "BOOTSTRAP_READY", { lockVersion: 9, ownerId: "worker_1" });

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
    expect(mocks.updatePayload).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({
        runtimeDeployment: expect.objectContaining({
          status: "provisioning",
          activationReady: false,
        }),
      }),
      { lockVersion: 9, ownerId: "worker_1" },
    );
    expect(mocks.updatePayload).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({
        runtimeDeployment: expect.objectContaining({
          status: "active",
          activationReady: true,
        }),
      }),
      { lockVersion: 9, ownerId: "worker_1" },
    );
    expect(mocks.updatePayload).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({
        bootstrapDeployment: expect.objectContaining({
          status: "ready",
          readinessMarker: "bootstrap_ready",
        }),
      }),
      { lockVersion: 9, ownerId: "worker_1" },
    );
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
