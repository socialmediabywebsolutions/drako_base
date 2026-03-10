import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const getFactoryIncidents = vi.fn();

  vi.doMock("@/lib/factory/incidents", () => ({
    getFactoryIncidents,
  }));

  const { getFactoryRecoveryCandidates } = await import("@/lib/factory/recovery");

  return {
    getFactoryRecoveryCandidates,
    getFactoryIncidents,
  };
}

describe("getFactoryRecoveryCandidates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("detects retry_job candidates from failed jobs", async () => {
    const { getFactoryRecoveryCandidates, getFactoryIncidents } = await loadSubject();

    getFactoryIncidents.mockResolvedValue({
      limit: 20,
      items: [
        {
          id: "job_failed_job_1",
          kind: "JOB_FAILED",
          relatedJobId: "job_1",
          relatedDomain: null,
        },
      ],
    });

    const candidates = await getFactoryRecoveryCandidates("tenant_owner");

    expect(candidates).toEqual([
      {
        id: "recovery_job_failed_job_1",
        type: "retry_job",
        relatedJobId: "job_1",
        reason: "Failed provisioning jobs can be retried when the underlying error is transient.",
      },
    ]);
  });

  it("detects retry_domain_verify candidates from pending and failed domains", async () => {
    const { getFactoryRecoveryCandidates, getFactoryIncidents } = await loadSubject();

    getFactoryIncidents.mockResolvedValue({
      limit: 20,
      items: [
        {
          id: "domain_pending_alpha.drako.systems",
          kind: "DOMAIN_PENDING",
          relatedJobId: null,
          relatedDomain: "alpha.drako.systems",
        },
        {
          id: "domain_failed_beta.drako.systems",
          kind: "DOMAIN_FAILED",
          relatedJobId: null,
          relatedDomain: "beta.drako.systems",
        },
      ],
    });

    const candidates = await getFactoryRecoveryCandidates("tenant_owner");

    expect(candidates).toEqual([
      {
        id: "recovery_domain_pending_alpha.drako.systems",
        type: "retry_domain_verify",
        relatedDomain: "alpha.drako.systems",
        reason: "Domain verification can be retried after DNS or provider conditions improve.",
      },
      {
        id: "recovery_domain_failed_beta.drako.systems",
        type: "retry_domain_verify",
        relatedDomain: "beta.drako.systems",
        reason: "Domain verification can be retried after DNS or provider conditions improve.",
      },
    ]);
  });

  it("ignores incidents that do not have an auto recovery path", async () => {
    const { getFactoryRecoveryCandidates, getFactoryIncidents } = await loadSubject();

    getFactoryIncidents.mockResolvedValue({
      limit: 20,
      items: [
        {
          id: "quota_pressure_jobs",
          kind: "QUOTA_PRESSURE",
          relatedJobId: null,
          relatedDomain: null,
        },
        {
          id: "job_degraded_job_2",
          kind: "JOB_DEGRADED",
          relatedJobId: "job_2",
          relatedDomain: null,
        },
      ],
    });

    const candidates = await getFactoryRecoveryCandidates("tenant_owner");

    expect(candidates).toEqual([]);
  });

  it("returns no candidates when there are no incidents", async () => {
    const { getFactoryRecoveryCandidates, getFactoryIncidents } = await loadSubject();

    getFactoryIncidents.mockResolvedValue({
      limit: 20,
      items: [],
    });

    const candidates = await getFactoryRecoveryCandidates("tenant_owner");

    expect(candidates).toEqual([]);
  });

  it("passes through the optional limit to incident detection", async () => {
    const { getFactoryRecoveryCandidates, getFactoryIncidents } = await loadSubject();

    getFactoryIncidents.mockResolvedValue({
      limit: 2,
      items: [
        {
          id: "job_failed_job_1",
          kind: "JOB_FAILED",
          relatedJobId: "job_1",
          relatedDomain: null,
        },
        {
          id: "domain_pending_alpha.drako.systems",
          kind: "DOMAIN_PENDING",
          relatedJobId: null,
          relatedDomain: "alpha.drako.systems",
        },
        {
          id: "domain_failed_beta.drako.systems",
          kind: "DOMAIN_FAILED",
          relatedJobId: null,
          relatedDomain: "beta.drako.systems",
        },
      ],
    });

    const candidates = await getFactoryRecoveryCandidates("tenant_owner", { limit: 2 });

    expect(getFactoryIncidents).toHaveBeenCalledWith("tenant_owner", { limit: 2 });
    expect(candidates).toHaveLength(2);
  });
});
