import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDb } from "@/__tests__/setup";
import { env as resolveEnv } from "@/lib/cf";
import { factoryCreateSaasMocks, setupFactoryCreateSaasOwnerMocks } from "./factory-create-saas.test-kit";
import {
  buildCreateSaasRequest,
  createFactoryRuntimeEnv,
  createCloudflareFetch,
  createProvisioningHarnessStore,
  findCustomDomainRow,
  findPrimaryDomainRow,
  findProvisioningJob,
  installProvisioningDbMock,
  processQueuedFactoryJob,
  type ProvisioningHarnessStore,
} from "./factory-create-saas.helpers";

// High-fidelity integration flow test. The file keeps the `e2e` name because it
// exercises the canonical route -> queue -> consumer -> orchestrator pipeline,
// but the backing infra is deterministic in-memory test harnesses.

import { POST as createSaas } from "@/app/api/owner/saas-factory/create-saas/route";
import { GET as getJobStatus } from "@/app/api/owner/saas-factory/jobs/[jobId]/route";
import { GET as getDomainsHealth } from "@/app/api/owner/domains/health/route";

type JobStatusPayload = {
  ok: boolean;
  correlationId: string;
  job: {
    jobId: string;
    saasId: string;
    state: string;
    rawState: string;
    timeline: Array<{ type: string; step: string; state: string; status: string; details: string | null }>;
  };
};

type DomainsHealthPayload = {
  ok: boolean;
  pendingDomains: Array<{ hostname: string; status: string; saasId: string }>;
  degradedJobs: Array<{ jobId: string; hostname: string | null; state: string }>;
  slo: { degraded: boolean };
};

type CreateSaasPayload = {
  ok: boolean;
  jobId: string;
  correlationId: string;
};

async function fetchJob(jobId: string) {
  const jobResponse = await getJobStatus(
    new Request(`https://drako.systems/api/owner/saas-factory/jobs/${jobId}`) as any,
    { params: Promise.resolve({ jobId }) },
  );
  expect(jobResponse.status).toBe(200);
  return await jobResponse.json() as JobStatusPayload;
}

async function fetchDomainsHealth() {
  const healthResponse = await getDomainsHealth(
    new Request("https://drako.systems/api/owner/domains/health?limit=10") as any,
  );
  expect(healthResponse.status).toBe(200);
  return await healthResponse.json() as DomainsHealthPayload;
}

function parseEventMetadata(store: ProvisioningHarnessStore, type: string) {
  return store.campamentoEvents
    .filter((event) => event.type === type)
    .map((event) => ({
      ...event,
      parsedMetadata: event.metadata ? (JSON.parse(event.metadata) as Record<string, unknown>) : null,
    }));
}

function parseProvisioningPlan(store: ProvisioningHarnessStore, saasId: string) {
  const runtimeRow = store.campamentoProvisioning.find((row) => row.saas_id === saasId);
  return runtimeRow?.plan ? (JSON.parse(runtimeRow.plan) as Record<string, unknown>) : null;
}

function expectNoRollback(jobPayload: JobStatusPayload) {
  expect(jobPayload.job.timeline.some((entry) => entry.type === "rollback")).toBe(false);
}

function expectNoFailureOutcome(store: ProvisioningHarnessStore, correlationId: string) {
  expect(
    store.campamentoEvents.some(
      (event) =>
        event.correlation_id === correlationId
        && event.type === "provision.saas_factory.job.failed",
    ),
  ).toBe(false);
}

function expectActiveDomainsOmittedFromHealth(healthPayload: DomainsHealthPayload, hostname: string) {
  // /api/owner/domains/health only reports pending/provisioning domains and degraded jobs.
  expect(healthPayload.pendingDomains.some((domain) => domain.hostname === hostname)).toBe(false);
}

describe("factory create-saas e2e", () => {
  beforeEach(() => {
    setupFactoryCreateSaasOwnerMocks();
  });

  it("runs the canonical pipeline to SUCCESS with an active domain", async () => {
    const store = createProvisioningHarnessStore();
    const runtimeEnv = createFactoryRuntimeEnv({ db: mockDb, store });
    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);
    factoryCreateSaasMocks.domainFetchImpl.mockImplementation(createCloudflareFetch({ verifyStatuses: ["active"], createStatus: "pending" }));

    const createResponse = await createSaas(buildCreateSaasRequest({ slug: "e2e-success-saas" }) as any);
    expect(createResponse.status).toBe(202);

    const createPayload = await createResponse.json() as CreateSaasPayload;
    expect(createPayload.ok).toBe(true);
    expect(createPayload.jobId).toBeTruthy();
    expect(store.sentQueueMessages).toHaveLength(1);

    await processQueuedFactoryJob(store, runtimeEnv, createPayload.jobId);

    const jobPayload = await fetchJob(createPayload.jobId);
    expect(jobPayload.job.state).toBe("SUCCESS");
    expect(jobPayload.job.rawState).toBe("SUCCESS");
    expect(jobPayload.job.timeline.some((entry) => entry.step === "COMPLETION")).toBe(true);
    expectNoRollback(jobPayload);

    const domainRow = findPrimaryDomainRow(store, jobPayload.job.saasId);
    expect(domainRow?.status).toBe("active");
    const saasRow = store.saas.find((row) => row.id === jobPayload.job.saasId);
    const instanceRow = store.saasInstances.find((row) => row.id === jobPayload.job.saasId);
    const runtimeRow = store.campamentoProvisioning.find((row) => row.saas_id === jobPayload.job.saasId);
    const provisioningPlan = parseProvisioningPlan(store, jobPayload.job.saasId) as {
      bootstrap?: { status?: string; readinessMarker?: string; featureKeys?: string[] };
    } | null;
    expect(saasRow).toMatchObject({
      status: "active",
      domain: domainRow?.domain,
      public_domain: domainRow?.domain,
      domain_status: "active",
    });
    expect(instanceRow).toMatchObject({
      status: "active",
      trial_domain: domainRow?.domain,
      domain_status: "active",
    });
    expect(runtimeRow?.status).toBe("active");
    expect(provisioningPlan?.bootstrap).toMatchObject({
      status: "ready",
      readinessMarker: "bootstrap_ready",
    });
    expect(store.saasBrandingSettings.find((row) => row.saas_id === jobPayload.job.saasId)).toBeTruthy();
    expect(store.saasFeatures.filter((row) => row.saas_id === jobPayload.job.saasId && row.status === "ENABLED").length).toBeGreaterThan(0);
    expect(jobPayload.job.timeline.some((entry) => entry.state === "BOOTSTRAP_READY")).toBe(true);
    expect(jobPayload.job.timeline.some((entry) => entry.state === "CUSTOM_DOMAIN_READY")).toBe(true);

    const healthPayload = await fetchDomainsHealth();
    expect(healthPayload.ok).toBe(true);
    expectActiveDomainsOmittedFromHealth(healthPayload, domainRow!.domain);
    expect(healthPayload.degradedJobs.find((job) => job.jobId === createPayload.jobId)).toBeUndefined();
    expect(healthPayload.slo.degraded).toBe(false);

    const finalEvents = parseEventMetadata(store, "provision.saas_factory.job.succeeded");
    expect(finalEvents.some((event) => event.parsedMetadata?.finalState === "SUCCESS")).toBe(true);
    expectNoFailureOutcome(store, createPayload.correlationId);
    expect(findProvisioningJob(store, createPayload.jobId)?.rollback_history_json).toBe("[]");
  });

  it("runs the canonical pipeline to DEGRADED without destructive rollback", async () => {
    const store = createProvisioningHarnessStore();
    const runtimeEnv = createFactoryRuntimeEnv({ db: mockDb, store });
    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);
    factoryCreateSaasMocks.domainFetchImpl.mockImplementation(createCloudflareFetch({ verifyStatuses: ["pending"], createStatus: "pending" }));

    const createResponse = await createSaas(buildCreateSaasRequest({ slug: "e2e-degraded-saas" }) as any);
    expect(createResponse.status).toBe(202);

    const createPayload = await createResponse.json() as CreateSaasPayload;
    expect(createPayload.ok).toBe(true);
    expect(createPayload.jobId).toBeTruthy();

    await processQueuedFactoryJob(store, runtimeEnv, createPayload.jobId);

    const jobPayload = await fetchJob(createPayload.jobId);
    expect(jobPayload.job.state).toBe("DEGRADED");
    expect(jobPayload.job.rawState).toBe("DEGRADED");
    expect(jobPayload.job.timeline.some((entry) => entry.step === "DEGRADED_COMPLETION")).toBe(true);
    expectNoRollback(jobPayload);

    const domainRow = findPrimaryDomainRow(store, jobPayload.job.saasId);
    expect(domainRow?.status).toBe("pending");
    const saasRow = store.saas.find((row) => row.id === jobPayload.job.saasId);
    const instanceRow = store.saasInstances.find((row) => row.id === jobPayload.job.saasId);
    const runtimeRow = store.campamentoProvisioning.find((row) => row.saas_id === jobPayload.job.saasId);
    const provisioningPlan = parseProvisioningPlan(store, jobPayload.job.saasId) as {
      bootstrap?: { status?: string; readinessMarker?: string };
    } | null;
    expect(saasRow).toMatchObject({
      status: "provisioning",
      domain: domainRow?.domain,
      public_domain: domainRow?.domain,
      domain_status: "pending",
    });
    expect(instanceRow).toMatchObject({
      status: "provisioning",
      trial_domain: domainRow?.domain,
      domain_status: "pending",
    });
    expect(runtimeRow?.status).toBe("degraded");
    expect(provisioningPlan?.bootstrap?.status).toBe("pending");

    const healthPayload = await fetchDomainsHealth();
    expect(healthPayload.pendingDomains.some((domain) => domain.hostname === domainRow?.domain)).toBe(true);
    expect(healthPayload.degradedJobs.some((job) => job.jobId === createPayload.jobId && job.state === "DEGRADED")).toBe(true);
    expect(healthPayload.slo.degraded).toBe(false);

    const finalEvents = parseEventMetadata(store, "provision.saas_factory.job.succeeded");
    expect(finalEvents.some((event) => event.parsedMetadata?.finalState === "DEGRADED")).toBe(true);
    expect(store.campamentoEvents.some((event) => event.type === "provision.domain.degraded")).toBe(true);
    expectNoFailureOutcome(store, createPayload.correlationId);
    expect(findProvisioningJob(store, createPayload.jobId)?.rollback_history_json).toBe("[]");
  });

  it("runs the canonical pipeline to SUCCESS with an active requested custom domain", async () => {
    const store = createProvisioningHarnessStore();
    const runtimeEnv = createFactoryRuntimeEnv({ db: mockDb, store });
    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);
    factoryCreateSaasMocks.domainFetchImpl.mockImplementation(
      createCloudflareFetch({
        verifyStatuses: ["active"],
        createStatus: "pending",
        hostnameStatuses: {
          "e2e-custom-success-saas.drako.systems": ["active"],
          "app.e2e-custom-success.com": ["active"],
        },
      }),
    );

    const createResponse = await createSaas(
      buildCreateSaasRequest({
        slug: "e2e-custom-success-saas",
        customDomainRequested: "app.e2e-custom-success.com",
      }) as any,
    );
    expect(createResponse.status).toBe(202);

    const createPayload = await createResponse.json() as CreateSaasPayload;
    await processQueuedFactoryJob(store, runtimeEnv, createPayload.jobId);

    const jobPayload = await fetchJob(createPayload.jobId);
    expect(jobPayload.job.state).toBe("SUCCESS");
    expect(jobPayload.job.timeline.some((entry) => entry.state === "CUSTOM_DOMAIN_READY")).toBe(true);
    expectNoRollback(jobPayload);

    const primaryDomainRow = findPrimaryDomainRow(store, jobPayload.job.saasId);
    const customDomainRow = findCustomDomainRow(store, jobPayload.job.saasId, "app.e2e-custom-success.com");
    const instanceRow = store.saasInstances.find((row) => row.id === jobPayload.job.saasId);
    const provisioningPlan = parseProvisioningPlan(store, jobPayload.job.saasId) as {
      bootstrap?: { status?: string };
      customDomainDeployment?: { status?: string; verificationReady?: boolean; requestedDomain?: string; providerStatus?: string };
    } | null;

    expect(primaryDomainRow?.status).toBe("active");
    expect(customDomainRow).toMatchObject({
      domain: "app.e2e-custom-success.com",
      status: "active",
      is_primary: 0,
    });
    expect(instanceRow).toMatchObject({
      status: "active",
      trial_domain: primaryDomainRow?.domain,
      custom_domain: "app.e2e-custom-success.com",
      domain_status: "active",
    });
    expect(provisioningPlan?.bootstrap?.status).toBe("ready");
    expect(provisioningPlan?.customDomainDeployment).toMatchObject({
      status: "active",
      verificationReady: true,
      requestedDomain: "app.e2e-custom-success.com",
      providerStatus: "active",
    });

    const healthPayload = await fetchDomainsHealth();
    expectActiveDomainsOmittedFromHealth(healthPayload, primaryDomainRow!.domain);
    expectActiveDomainsOmittedFromHealth(healthPayload, "app.e2e-custom-success.com");
    expect(healthPayload.degradedJobs.find((job) => job.jobId === createPayload.jobId)).toBeUndefined();
  });

  it("marks the canonical pipeline DEGRADED when the requested custom domain remains pending", async () => {
    const store = createProvisioningHarnessStore();
    const runtimeEnv = createFactoryRuntimeEnv({ db: mockDb, store });
    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);
    factoryCreateSaasMocks.domainFetchImpl.mockImplementation(
      createCloudflareFetch({
        verifyStatuses: ["active"],
        createStatus: "pending",
        hostnameStatuses: {
          "e2e-custom-degraded-saas.drako.systems": ["active"],
          "app.e2e-custom-degraded.com": ["pending"],
        },
      }),
    );

    const createResponse = await createSaas(
      buildCreateSaasRequest({
        slug: "e2e-custom-degraded-saas",
        customDomainRequested: "app.e2e-custom-degraded.com",
      }) as any,
    );
    expect(createResponse.status).toBe(202);

    const createPayload = await createResponse.json() as CreateSaasPayload;
    await processQueuedFactoryJob(store, runtimeEnv, createPayload.jobId);

    const jobPayload = await fetchJob(createPayload.jobId);
    expect(jobPayload.job.state).toBe("DEGRADED");
    expect(jobPayload.job.timeline.some((entry) => entry.state === "CUSTOM_DOMAIN_READY")).toBe(true);
    expectNoRollback(jobPayload);

    const primaryDomainRow = findPrimaryDomainRow(store, jobPayload.job.saasId);
    const customDomainRow = findCustomDomainRow(store, jobPayload.job.saasId, "app.e2e-custom-degraded.com");
    const provisioningPlan = parseProvisioningPlan(store, jobPayload.job.saasId) as {
      bootstrap?: { status?: string };
      customDomainDeployment?: { status?: string; verificationReady?: boolean; degradedReason?: string; requestedDomain?: string };
    } | null;

    expect(primaryDomainRow?.status).toBe("active");
    expect(customDomainRow?.status).toBe("pending");
    expect(provisioningPlan?.bootstrap?.status).toBe("ready");
    expect(provisioningPlan?.customDomainDeployment).toMatchObject({
      status: "degraded",
      verificationReady: false,
      degradedReason: "CUSTOM_DOMAIN_PENDING:pending",
      requestedDomain: "app.e2e-custom-degraded.com",
    });

    const healthPayload = await fetchDomainsHealth();
    expectActiveDomainsOmittedFromHealth(healthPayload, primaryDomainRow!.domain);
    expect(healthPayload.pendingDomains.some((domain) => domain.hostname === "app.e2e-custom-degraded.com")).toBe(true);
    expect(healthPayload.degradedJobs.some((job) => job.jobId === createPayload.jobId && job.state === "DEGRADED")).toBe(true);
  });

  it("marks the canonical pipeline DEGRADED when bootstrap is partial after activation is valid", async () => {
    const store = createProvisioningHarnessStore();
    const runtimeEnv = createFactoryRuntimeEnv({
      db: mockDb,
      store,
      overrides: { PROVISIONING_FAULT_AT: "BOOTSTRAP_PARTIAL_READY" },
    });
    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);
    factoryCreateSaasMocks.domainFetchImpl.mockImplementation(createCloudflareFetch({ verifyStatuses: ["active"], createStatus: "pending" }));

    const createResponse = await createSaas(buildCreateSaasRequest({ slug: "e2e-bootstrap-degraded-saas" }) as any);
    expect(createResponse.status).toBe(202);

    const createPayload = await createResponse.json() as CreateSaasPayload;
    await processQueuedFactoryJob(store, runtimeEnv, createPayload.jobId);

    const jobPayload = await fetchJob(createPayload.jobId);
    expect(jobPayload.job.state).toBe("DEGRADED");
    expect(jobPayload.job.rawState).toBe("DEGRADED");
    expect(jobPayload.job.timeline.some((entry) => entry.state === "BOOTSTRAP_READY")).toBe(true);

    const domainRow = findPrimaryDomainRow(store, jobPayload.job.saasId);
    const saasRow = store.saas.find((row) => row.id === jobPayload.job.saasId);
    const instanceRow = store.saasInstances.find((row) => row.id === jobPayload.job.saasId);
    const runtimeRow = store.campamentoProvisioning.find((row) => row.saas_id === jobPayload.job.saasId);
    const provisioningPlan = parseProvisioningPlan(store, jobPayload.job.saasId) as {
      bootstrap?: { status?: string; readinessMarker?: string; degradedReason?: string; featureKeys?: string[]; expectedFeatureKeys?: string[] };
    } | null;

    expect(domainRow?.status).toBe("active");
    expect(saasRow?.status).toBe("active");
    expect(instanceRow?.status).toBe("active");
    expect(runtimeRow?.status).toBe("active");
    expect(provisioningPlan?.bootstrap).toMatchObject({
      status: "degraded",
      readinessMarker: "bootstrap_partial",
    });
    expect(provisioningPlan?.bootstrap?.featureKeys?.length).toBeGreaterThan(0);
    expect(provisioningPlan?.bootstrap?.expectedFeatureKeys?.length).toBeGreaterThan(
      provisioningPlan?.bootstrap?.featureKeys?.length ?? 0,
    );
    expect(store.saasBrandingSettings.find((row) => row.saas_id === jobPayload.job.saasId)).toBeTruthy();
    expect(store.saasFeatures.filter((row) => row.saas_id === jobPayload.job.saasId && row.status === "ENABLED").length).toBeGreaterThan(0);
  });
});
