import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDb } from "@/__tests__/setup";
import { env as resolveEnv } from "@/lib/cf";
import { factoryCreateSaasMocks, setupFactoryCreateSaasOwnerMocks } from "./factory-create-saas.test-kit";
import {
  buildCreateSaasRequest,
  createCloudflareFetch,
  createFactoryRuntimeEnv,
  createProvisioningHarnessStore,
  findPrimaryDomainRow,
  findProvisioningJob,
  installProvisioningDbMock,
  type ProvisioningHarnessStore,
  processQueuedFactoryJob,
} from "./factory-create-saas.helpers";

import { POST as createSaas } from "@/app/api/owner/saas-factory/create-saas/route";
import { GET as getJobStatus } from "@/app/api/owner/saas-factory/jobs/[jobId]/route";

type CreateSaasPayload = {
  ok: boolean;
  queued: boolean;
  jobId: string;
  state: string;
  saasId: string;
  correlationId: string;
  idempotencyKey: string;
};

type JobStatusPayload = {
  ok: boolean;
  job: {
    jobId: string;
    saasId: string;
    state: string;
    rawState: string;
  };
};

function parseEventMetadata(store: ProvisioningHarnessStore, type: string) {
  return store.campamentoEvents
    .filter((event) => event.type === type)
    .map((event) => ({
      ...event,
      parsedMetadata: event.metadata ? (JSON.parse(event.metadata) as Record<string, unknown>) : null,
    }));
}

async function fetchJob(jobId: string) {
  const jobResponse = await getJobStatus(
    new Request(`https://drako.systems/api/owner/saas-factory/jobs/${jobId}`) as any,
    { params: Promise.resolve({ jobId }) },
  );
  expect(jobResponse.status).toBe(200);
  return await jobResponse.json() as JobStatusPayload;
}

describe("factory create-saas idempotency", () => {
  beforeEach(() => {
    setupFactoryCreateSaasOwnerMocks();
  });

  it("reuses the existing job for repeated POSTs with the same idempotencyKey", async () => {
    const store = createProvisioningHarnessStore();
    const runtimeEnv = createFactoryRuntimeEnv({ db: mockDb, store });
    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);
    factoryCreateSaasMocks.domainFetchImpl.mockImplementation(createCloudflareFetch({ verifyStatuses: ["active"], createStatus: "pending" }));

    const requestParams = {
      slug: "e2e-idempotent-saas",
      idempotencyKey: "idem_e2e_idempotent_0001",
      correlationId: "corr_e2e_idempotent_0001",
    } as const;

    const firstResponse = await createSaas(buildCreateSaasRequest(requestParams) as any);
    expect(firstResponse.status).toBe(202);
    const firstPayload = await firstResponse.json() as CreateSaasPayload;
    expect(firstPayload.ok).toBe(true);
    expect(firstPayload.queued).toBe(true);
    expect(firstPayload.state).toBe("CREATED");

    const secondResponse = await createSaas(buildCreateSaasRequest(requestParams) as any);
    expect(secondResponse.status).toBe(200);
    const secondPayload = await secondResponse.json() as CreateSaasPayload;
    expect(secondPayload.ok).toBe(true);
    expect(secondPayload.queued).toBe(false);
    expect(secondPayload.jobId).toBe(firstPayload.jobId);
    expect(secondPayload.saasId).toBe(firstPayload.saasId);
    expect(secondPayload.idempotencyKey).toBe(firstPayload.idempotencyKey);
    expect(secondPayload.state).toBe("CREATED");

    expect(store.provisioningJobs).toHaveLength(1);
    expect(findProvisioningJob(store, firstPayload.jobId)?.idempotency_key).toBe(firstPayload.idempotencyKey);
    expect(store.sentQueueMessages).toHaveLength(1);
    expect(store.sentQueueMessages[0]?.jobId).toBe(firstPayload.jobId);
    expect(store.saas).toHaveLength(0);
    expect(store.saasDomains).toHaveLength(0);

    await processQueuedFactoryJob(store, runtimeEnv, firstPayload.jobId);

    const jobPayload = await fetchJob(firstPayload.jobId);
    expect(jobPayload.job.state).toBe("SUCCESS");
    expect(jobPayload.job.rawState).toBe("SUCCESS");

    const thirdResponse = await createSaas(buildCreateSaasRequest(requestParams) as any);
    expect(thirdResponse.status).toBe(200);
    const thirdPayload = await thirdResponse.json() as CreateSaasPayload;
    expect(thirdPayload.queued).toBe(false);
    expect(thirdPayload.jobId).toBe(firstPayload.jobId);
    expect(thirdPayload.state).toBe("SUCCESS");

    expect(store.provisioningJobs).toHaveLength(1);
    expect(store.saas.filter((row) => row.slug === requestParams.slug)).toHaveLength(1);

    const expectedHostname = `${requestParams.slug}.drako.systems`;
    expect(store.saasDomains.filter((row) => row.domain === expectedHostname)).toHaveLength(1);

    const domainRow = findPrimaryDomainRow(store, jobPayload.job.saasId);
    expect(domainRow?.domain).toBe(expectedHostname);
    expect(domainRow?.status).toBe("active");
    expect(store.saas.find((row) => row.id === jobPayload.job.saasId)).toMatchObject({
      status: "active",
      domain: expectedHostname,
      public_domain: expectedHostname,
      domain_status: "active",
    });
    expect(store.saasInstances.find((row) => row.id === jobPayload.job.saasId)).toMatchObject({
      status: "active",
      trial_domain: expectedHostname,
      domain_status: "active",
    });
    expect(store.campamentoProvisioning.find((row) => row.saas_id === jobPayload.job.saasId)?.status).toBe("active");

    expect(parseEventMetadata(store, "provision.saas_factory.job.queued")).toHaveLength(1);
    expect(parseEventMetadata(store, "provision.saas_factory.job.reused")).toHaveLength(2);
  });
});
