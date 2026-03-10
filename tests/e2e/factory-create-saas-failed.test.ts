import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDb } from "@/__tests__/setup";
import { env as resolveEnv } from "@/lib/cf";
import {
  buildCreateSaasRequest,
  createFactoryRuntimeEnv,
  createProvisioningHarnessStore,
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

function createFatalCreateCloudflareFetch(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "GET" && url.pathname.endsWith("/custom_hostnames") && url.searchParams.has("hostname")) {
      return new Response(JSON.stringify({ success: true, result: [] }), { status: 200 });
    }

    if (method === "POST" && url.pathname.endsWith("/custom_hostnames")) {
      return new Response(
        JSON.stringify({ success: false, errors: [{ message: "fatal create failure" }] }),
        { status: 503 },
      );
    }

    return new Response(
      JSON.stringify({ success: false, errors: [{ message: `Unhandled Cloudflare call ${method} ${url.pathname}` }] }),
      { status: 500 },
    );
  }) as typeof fetch;
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

  it("persists a real FAILED outcome when domain binding creation fails fatally", async () => {
    const store = createProvisioningHarnessStore();
    const runtimeEnv = createFactoryRuntimeEnv({ db: mockDb, store });
    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);
    mocks.domainFetchImpl.mockImplementation(createFatalCreateCloudflareFetch());

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
