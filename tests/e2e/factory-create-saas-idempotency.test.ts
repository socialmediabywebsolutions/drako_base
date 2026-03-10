import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDb } from "@/__tests__/setup";
import { env as resolveEnv } from "@/lib/cf";
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

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    status: number;

    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.name = "UnauthorizedError";
      this.status = status;
    }
  }

  return {
    extractSessionFromRequest: vi.fn(),
    authorizeSaasAccess: vi.fn(),
    requireOwnerAccess: vi.fn(),
    ensureCampamentoBase: vi.fn(),
    domainFetchImpl: vi.fn(),
    UnauthorizedError,
  };
});

vi.mock("@/lib/edge-auth", () => ({
  extractSessionFromRequest: mocks.extractSessionFromRequest,
}));

vi.mock("@/lib/authz/saas-access", () => ({
  authorizeSaasAccess: mocks.authorizeSaasAccess,
}));

vi.mock("@/lib/auth/session", () => ({
  requireOwnerAccess: mocks.requireOwnerAccess,
  UnauthorizedError: mocks.UnauthorizedError,
}));

vi.mock("@/lib/campamento-base", () => ({
  ensureCampamentoBase: mocks.ensureCampamentoBase,
}));

vi.mock("@/lib/domains/domain-provider", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/domains/domain-provider")>();
  return {
    ...actual,
    createDomainBinding: (input: Parameters<typeof actual.createDomainBinding>[0]) =>
      actual.createDomainBinding({ ...input, fetchImpl: mocks.domainFetchImpl as unknown as typeof fetch }),
    verifyDomainBinding: (input: Parameters<typeof actual.verifyDomainBinding>[0]) =>
      actual.verifyDomainBinding({ ...input, fetchImpl: mocks.domainFetchImpl as unknown as typeof fetch }),
    deleteDomainBinding: (input: Parameters<typeof actual.deleteDomainBinding>[0]) =>
      actual.deleteDomainBinding({ ...input, fetchImpl: mocks.domainFetchImpl as unknown as typeof fetch }),
  };
});

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
    vi.clearAllMocks();
    mocks.ensureCampamentoBase.mockResolvedValue(undefined);
    mocks.extractSessionFromRequest.mockResolvedValue({
      userId: "owner_user",
      email: "owner@drako.systems",
      tenantId: "tenant_owner",
      role: "admin",
      iat: 1,
      exp: 9_999_999_999,
    });
    mocks.authorizeSaasAccess.mockResolvedValue({ authorized: true });
    mocks.requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
  });

  it("reuses the existing job for repeated POSTs with the same idempotencyKey", async () => {
    const store = createProvisioningHarnessStore();
    const runtimeEnv = createFactoryRuntimeEnv({ db: mockDb, store });
    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);
    mocks.domainFetchImpl.mockImplementation(createCloudflareFetch({ verifyStatuses: ["active"], createStatus: "pending" }));

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

    expect(parseEventMetadata(store, "provision.saas_factory.job.queued")).toHaveLength(1);
    expect(parseEventMetadata(store, "provision.saas_factory.job.reused")).toHaveLength(2);
  });
});
