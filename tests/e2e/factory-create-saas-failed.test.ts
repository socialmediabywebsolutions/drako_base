import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDb } from "@/__tests__/setup";
import { env as resolveEnv } from "@/lib/cf";
import { factoryCreateSaasMocks, setupFactoryCreateSaasOwnerMocks } from "./factory-create-saas.test-kit";
import {
  buildCreateSaasRequest,
  createCloudflareFetch,
  createFactoryRuntimeEnv,
  createProvisioningHarnessStore,
  findProvisioningJob,
  installProvisioningDbMock,
  type ProvisioningHarnessStore,
  processQueuedFactoryJob,
} from "./factory-create-saas.helpers";

import { POST as createSaas } from "@/app/api/owner/saas-factory/create-saas/route";
import { GET as getJobStatus } from "@/app/api/owner/saas-factory/jobs/[jobId]/route";
import { GET as getDomainsHealth } from "@/app/api/owner/domains/health/route";

type CreateSaasPayload = {
  ok: boolean;
  jobId: string;
  correlationId: string;
};

type JobStatusPayload = {
  ok: boolean;
  job: {
    jobId: string;
    saasId: string;
    state: string;
    rawState: string;
    error: string | null;
    timeline: Array<{ type: string; step: string; state: string; status: string; details: string | null }>;
  };
};

type DomainsHealthPayload = {
  ok: boolean;
  pendingDomains: Array<{ hostname: string; status: string; saasId: string }>;
  degradedJobs: Array<{ jobId: string; hostname: string | null; state: string }>;
  slo: { degraded: boolean };
};

function parseEventMetadata(store: ProvisioningHarnessStore, type: string) {
  return store.campamentoEvents
    .filter((event) => event.type === type)
    .map((event) => ({
      ...event,
      parsedMetadata: event.metadata ? (JSON.parse(event.metadata) as Record<string, unknown>) : null,
    }));
}

function parseRollbackHistory(store: ProvisioningHarnessStore, jobId: string) {
  const raw = findProvisioningJob(store, jobId)?.rollback_history_json ?? "[]";
  return JSON.parse(raw) as Array<{ step?: string; details?: string }>;
}

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

describe("factory create-saas failed path", () => {
  beforeEach(() => {
    setupFactoryCreateSaasOwnerMocks();
  });

  it("persists a real FAILED outcome when domain binding creation fails fatally", async () => {
    const store = createProvisioningHarnessStore();
    const runtimeEnv = createFactoryRuntimeEnv({ db: mockDb, store });
    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);
    factoryCreateSaasMocks.domainFetchImpl.mockImplementation(
      createCloudflareFetch({ verifyStatuses: ["active"], failCreateMessage: "fatal create failure" }),
    );

    const createResponse = await createSaas(buildCreateSaasRequest({ slug: "e2e-failed-saas" }) as any);
    expect(createResponse.status).toBe(202);

    const createPayload = await createResponse.json() as CreateSaasPayload;
    expect(createPayload.ok).toBe(true);
    expect(createPayload.jobId).toBeTruthy();
    expect(store.sentQueueMessages).toHaveLength(1);

    await processQueuedFactoryJob(store, runtimeEnv, createPayload.jobId);

    const jobPayload = await fetchJob(createPayload.jobId);
    expect(jobPayload.job.state).toBe("FAILED");
    expect(jobPayload.job.rawState).toBe("FAILED");
    expect(jobPayload.job.error).toBe("fatal create failure");
    expect(jobPayload.job.timeline.some((entry) => entry.type === "step" && entry.step === "FAILURE" && entry.state === "FAILED")).toBe(true);
    expect(
      jobPayload.job.timeline.some(
        (entry) =>
          entry.type === "step"
          && entry.step === "TRANSITION_STRIPE_PRODUCT_CREATED_TO_PROVISION_WORKER"
          && entry.state === "PROVISION_WORKER",
      ),
    ).toBe(true);
    expect(
      jobPayload.job.timeline.some(
        (entry) =>
          entry.type === "step"
          && entry.step === "FAILURE"
          && entry.details === "fatal create failure",
      ),
    ).toBe(true);
    expect(jobPayload.job.timeline.some((entry) => entry.type === "step" && entry.state === "SUCCESS")).toBe(false);
    expect(jobPayload.job.timeline.some((entry) => entry.type === "step" && entry.state === "DEGRADED")).toBe(false);

    const rollbackHistory = parseRollbackHistory(store, createPayload.jobId);
    expect(rollbackHistory.map((entry) => entry.step)).toEqual(["DOMAINS_ROLLED_BACK", "DB"]);
    expect(jobPayload.job.timeline.filter((entry) => entry.type === "rollback").map((entry) => entry.step)).toEqual([
      "DOMAINS_ROLLED_BACK",
      "DB",
    ]);
    expect(rollbackHistory.some((entry) => entry.step === "ROLLBACK_ERROR")).toBe(false);

    expect(store.saas).toHaveLength(0);
    expect(store.saasInstances).toHaveLength(0);
    expect(store.saasDomains).toHaveLength(0);

    const healthPayload = await fetchDomainsHealth();
    expect(healthPayload.ok).toBe(true);
    expect(healthPayload.pendingDomains).toHaveLength(0);
    expect(healthPayload.degradedJobs).toHaveLength(0);
    expect(healthPayload.slo.degraded).toBe(false);

    const failedEvents = parseEventMetadata(store, "provision.saas_factory.job.failed");
    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0]?.parsedMetadata?.state).toBe("PROVISION_WORKER");
    expect(failedEvents[0]?.parsedMetadata?.error).toBe("fatal create failure");
    expect(parseEventMetadata(store, "provision.saas_factory.job.succeeded")).toHaveLength(0);
    expect(parseEventMetadata(store, "provision.domain.create.started")).toHaveLength(1);
    expect(parseEventMetadata(store, "provision.domain.create.succeeded")).toHaveLength(0);
  });
});
