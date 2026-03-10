import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const getFactoryIncidents = vi.fn();
  const getFactoryTrends = vi.fn();
  const getFactoryStatus = vi.fn();

  vi.doMock("@/lib/factory/incidents", () => ({
    getFactoryIncidents,
  }));

  vi.doMock("@/lib/factory/trends", () => ({
    getFactoryTrends,
  }));

  vi.doMock("@/lib/factory/status", () => ({
    getFactoryStatus,
  }));

  const { getFactoryOperatorActions } = await import("@/lib/factory/actions");

  return {
    getFactoryOperatorActions,
    getFactoryIncidents,
    getFactoryTrends,
    getFactoryStatus,
  };
}

describe("getFactoryOperatorActions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("generates actions from supported incident kinds", async () => {
    const { getFactoryOperatorActions, getFactoryIncidents, getFactoryTrends, getFactoryStatus } = await loadSubject();

    getFactoryIncidents.mockResolvedValue({
      limit: 20,
      items: [
        {
          id: "job_failed_job_1",
          kind: "JOB_FAILED",
          severity: "critical",
          message: "Job job_1 failed during provisioning.",
          relatedJobId: "job_1",
          relatedDomain: null,
        },
        {
          id: "domain_failed_foo.drako.systems",
          kind: "DOMAIN_FAILED",
          severity: "high",
          message: "Domain foo.drako.systems is marked as failed.",
          relatedJobId: null,
          relatedDomain: "foo.drako.systems",
        },
        {
          id: "domain_pending_bar.drako.systems",
          kind: "DOMAIN_PENDING",
          severity: "medium",
          message: "Domain bar.drako.systems is still pending.",
          relatedJobId: null,
          relatedDomain: "bar.drako.systems",
        },
        {
          id: "quota_pressure_jobs",
          kind: "QUOTA_PRESSURE",
          severity: "medium",
          message: "No concurrent provisioning job slots remain for this tenant.",
          relatedJobId: null,
          relatedDomain: null,
        },
      ],
    });
    getFactoryTrends.mockResolvedValue({
      summary: {
        totalRecentFailed: 1,
        totalRecentDegraded: 0,
        totalRecentSucceeded: 0,
      },
    });
    getFactoryStatus.mockResolvedValue({
      slo: {
        failing: true,
        degraded: false,
      },
      limits: {
        jobSlotsRemaining: 0,
        saasRemaining: 2,
        domainsRemaining: 3,
      },
    });

    const actions = await getFactoryOperatorActions("tenant_owner", { limit: 20 });

    expect(actions).toEqual([
      expect.objectContaining({
        severity: "critical",
        title: "Investigate failed provisioning job",
        recommendation: "Inspect job logs and retry provisioning if the error is transient.",
        relatedIncidentId: "job_failed_job_1",
        relatedJobId: "job_1",
      }),
      expect.objectContaining({
        severity: "high",
        title: "Investigate domain provisioning failure",
        recommendation: "Verify Cloudflare hostname configuration and retry verification.",
        relatedIncidentId: "domain_failed_foo.drako.systems",
        relatedDomain: "foo.drako.systems",
      }),
      expect.objectContaining({
        severity: "medium",
        title: "Domain still pending verification",
        recommendation: "Check DNS propagation and verify CNAME records.",
        relatedIncidentId: "domain_pending_bar.drako.systems",
        relatedDomain: "bar.drako.systems",
      }),
      expect.objectContaining({
        severity: "medium",
        title: "Factory capacity exhausted",
        recommendation: "Upgrade plan or free resources before creating new SaaS.",
        relatedIncidentId: "quota_pressure_jobs",
      }),
    ]);
  });

  it("returns no actions when there are no incidents", async () => {
    const { getFactoryOperatorActions, getFactoryIncidents, getFactoryTrends, getFactoryStatus } = await loadSubject();

    getFactoryIncidents.mockResolvedValue({
      limit: 20,
      items: [],
    });
    getFactoryTrends.mockResolvedValue({
      summary: {
        totalRecentFailed: 0,
        totalRecentDegraded: 0,
        totalRecentSucceeded: 3,
      },
    });
    getFactoryStatus.mockResolvedValue({
      slo: {
        failing: false,
        degraded: false,
      },
      limits: {
        jobSlotsRemaining: 3,
        saasRemaining: 5,
        domainsRemaining: 10,
      },
    });

    const actions = await getFactoryOperatorActions("tenant_owner");

    expect(actions).toEqual([]);
  });

  it("ignores unsupported incidents like JOB_DEGRADED in this first version", async () => {
    const { getFactoryOperatorActions, getFactoryIncidents, getFactoryTrends, getFactoryStatus } = await loadSubject();

    getFactoryIncidents.mockResolvedValue({
      limit: 20,
      items: [
        {
          id: "job_degraded_job_2",
          kind: "JOB_DEGRADED",
          severity: "high",
          message: "Job job_2 completed in degraded mode.",
          relatedJobId: "job_2",
          relatedDomain: null,
        },
      ],
    });
    getFactoryTrends.mockResolvedValue({
      summary: {
        totalRecentFailed: 0,
        totalRecentDegraded: 1,
        totalRecentSucceeded: 0,
      },
    });
    getFactoryStatus.mockResolvedValue({
      slo: {
        failing: false,
        degraded: true,
      },
      limits: {
        jobSlotsRemaining: 2,
        saasRemaining: 5,
        domainsRemaining: 10,
      },
    });

    const actions = await getFactoryOperatorActions("tenant_owner");

    expect(actions).toEqual([]);
  });

  it("applies the optional limit to the returned action list", async () => {
    const { getFactoryOperatorActions, getFactoryIncidents, getFactoryTrends, getFactoryStatus } = await loadSubject();

    getFactoryIncidents.mockResolvedValue({
      limit: 2,
      items: [
        {
          id: "job_failed_job_1",
          kind: "JOB_FAILED",
          severity: "critical",
          message: "Job job_1 failed during provisioning.",
          relatedJobId: "job_1",
          relatedDomain: null,
        },
        {
          id: "domain_failed_foo.drako.systems",
          kind: "DOMAIN_FAILED",
          severity: "high",
          message: "Domain foo.drako.systems is marked as failed.",
          relatedJobId: null,
          relatedDomain: "foo.drako.systems",
        },
        {
          id: "quota_pressure_jobs",
          kind: "QUOTA_PRESSURE",
          severity: "medium",
          message: "No concurrent provisioning job slots remain for this tenant.",
          relatedJobId: null,
          relatedDomain: null,
        },
      ],
    });
    getFactoryTrends.mockResolvedValue({
      summary: {
        totalRecentFailed: 1,
        totalRecentDegraded: 0,
        totalRecentSucceeded: 0,
      },
    });
    getFactoryStatus.mockResolvedValue({
      slo: {
        failing: true,
        degraded: false,
      },
      limits: {
        jobSlotsRemaining: 0,
        saasRemaining: 1,
        domainsRemaining: 2,
      },
    });

    const actions = await getFactoryOperatorActions("tenant_owner", { limit: 2 });

    expect(actions).toHaveLength(2);
    expect(getFactoryIncidents).toHaveBeenCalledWith("tenant_owner", { limit: 2 });
    expect(getFactoryTrends).toHaveBeenCalledWith("tenant_owner", { limit: 2 });
  });

  it("normalizes large limits before calling downstream signals", async () => {
    const { getFactoryOperatorActions, getFactoryIncidents, getFactoryTrends, getFactoryStatus } = await loadSubject();

    getFactoryIncidents.mockResolvedValue({
      limit: 100,
      items: [],
    });
    getFactoryTrends.mockResolvedValue({
      summary: {
        totalRecentFailed: 0,
        totalRecentDegraded: 0,
        totalRecentSucceeded: 0,
      },
    });
    getFactoryStatus.mockResolvedValue({
      slo: {
        failing: false,
        degraded: false,
      },
      limits: {
        jobSlotsRemaining: 3,
        saasRemaining: 5,
        domainsRemaining: 10,
      },
    });

    await getFactoryOperatorActions("tenant_owner", { limit: 999 });

    expect(getFactoryIncidents).toHaveBeenCalledWith("tenant_owner", { limit: 100 });
    expect(getFactoryTrends).toHaveBeenCalledWith("tenant_owner", { limit: 50 });
  });
});
