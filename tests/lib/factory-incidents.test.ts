import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const queryAll = vi.fn();
  const getFactoryStatus = vi.fn();

  vi.doMock("@/lib/db", () => ({
    queryAll,
  }));

  vi.doMock("@/lib/factory/status", () => ({
    getFactoryStatus,
  }));

  const { getFactoryIncidents } = await import("@/lib/factory/incidents");

  return {
    getFactoryIncidents,
    queryAll,
    getFactoryStatus,
  };
}

describe("getFactoryIncidents", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("generates incidents for failed and degraded jobs", async () => {
    const { getFactoryIncidents, queryAll, getFactoryStatus } = await loadSubject();

    queryAll
      .mockResolvedValueOnce([
        {
          job_id: "job_failed",
          entity_id: "saas_failed",
          current_state: "FAILED",
          correlation_id: "corr_failed",
          created_at: "2026-03-10T10:00:00.000Z",
          updated_at: "2026-03-10T10:05:00.000Z",
          last_error: "fatal create failure",
        },
        {
          job_id: "job_degraded",
          entity_id: "saas_degraded",
          current_state: "DEGRADED",
          correlation_id: "corr_degraded",
          created_at: "2026-03-10T09:00:00.000Z",
          updated_at: "2026-03-10T09:04:00.000Z",
          last_error: "verify pending",
        },
      ])
      .mockResolvedValueOnce([]);
    getFactoryStatus.mockResolvedValue({
      usage: {
        saasCount: 2,
        activeJobCount: 1,
        domainCount: 1,
      },
      limits: {
        saasRemaining: 3,
        jobSlotsRemaining: 2,
        domainsRemaining: 9,
      },
    });

    const incidents = await getFactoryIncidents("tenant_owner", { limit: 20 });

    expect(incidents.items[0]).toMatchObject({
      kind: "JOB_FAILED",
      severity: "critical",
      relatedJobId: "job_failed",
      relatedSaasId: "saas_failed",
      state: "FAILED",
    });
    expect(incidents.items[1]).toMatchObject({
      kind: "JOB_DEGRADED",
      severity: "high",
      relatedJobId: "job_degraded",
      relatedSaasId: "saas_degraded",
      state: "DEGRADED",
    });
  });

  it("generates incidents for failed and pending domains", async () => {
    const { getFactoryIncidents, queryAll, getFactoryStatus } = await loadSubject();

    queryAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          domain: "failed.drako.systems",
          saas_id: "saas_failed",
          status: "failed",
          created_at: "2026-03-10T10:00:00.000Z",
          updated_at: "2026-03-10T10:05:00.000Z",
          last_error: "hostname rejected",
        },
        {
          domain: "pending.drako.systems",
          saas_id: "saas_pending",
          status: "pending",
          created_at: "2026-03-10T09:00:00.000Z",
          updated_at: "2026-03-10T09:04:00.000Z",
          last_error: null,
        },
        {
          domain: "provisioning.drako.systems",
          saas_id: "saas_provisioning",
          status: "provisioning",
          created_at: "2026-03-10T08:00:00.000Z",
          updated_at: "2026-03-10T08:03:00.000Z",
          last_error: null,
        },
      ]);
    getFactoryStatus.mockResolvedValue({
      usage: {
        saasCount: 0,
        activeJobCount: 0,
        domainCount: 3,
      },
      limits: {
        saasRemaining: 5,
        jobSlotsRemaining: 3,
        domainsRemaining: 7,
      },
    });

    const incidents = await getFactoryIncidents("tenant_owner");

    expect(incidents.items[0]).toMatchObject({
      kind: "DOMAIN_FAILED",
      severity: "high",
      relatedDomain: "failed.drako.systems",
      relatedSaasId: "saas_failed",
      state: "failed",
    });
    expect(incidents.items[1]).toMatchObject({
      kind: "DOMAIN_PENDING",
      severity: "medium",
      relatedDomain: "pending.drako.systems",
      state: "pending",
    });
    expect(incidents.items[2]).toMatchObject({
      kind: "DOMAIN_PENDING",
      severity: "medium",
      relatedDomain: "provisioning.drako.systems",
      state: "provisioning",
    });
  });

  it("generates quota pressure incidents when capacity is exhausted", async () => {
    const { getFactoryIncidents, queryAll, getFactoryStatus } = await loadSubject();

    queryAll.mockResolvedValue([]);
    getFactoryStatus.mockResolvedValue({
      usage: {
        saasCount: 5,
        activeJobCount: 3,
        domainCount: 10,
      },
      limits: {
        saasRemaining: 0,
        jobSlotsRemaining: 0,
        domainsRemaining: 0,
      },
    });

    const incidents = await getFactoryIncidents("tenant_owner");

    expect(incidents.items).toEqual([
      expect.objectContaining({
        kind: "QUOTA_PRESSURE",
        severity: "medium",
        id: "quota_pressure_domains",
      }),
      expect.objectContaining({
        kind: "QUOTA_PRESSURE",
        severity: "medium",
        id: "quota_pressure_jobs",
      }),
      expect.objectContaining({
        kind: "QUOTA_PRESSURE",
        severity: "medium",
        id: "quota_pressure_saas",
      }),
    ]);
  });

  it("orders incidents by recency descending across jobs and domains", async () => {
    const { getFactoryIncidents, queryAll, getFactoryStatus } = await loadSubject();

    queryAll
      .mockResolvedValueOnce([
        {
          job_id: "job_old",
          entity_id: "saas_old",
          current_state: "FAILED",
          correlation_id: "corr_old",
          created_at: "2026-03-10T08:00:00.000Z",
          updated_at: "2026-03-10T08:01:00.000Z",
          last_error: "old failure",
        },
      ])
      .mockResolvedValueOnce([
        {
          domain: "fresh.drako.systems",
          saas_id: "saas_fresh",
          status: "failed",
          created_at: "2026-03-10T11:00:00.000Z",
          updated_at: "2026-03-10T11:05:00.000Z",
          last_error: "dns failure",
        },
      ]);
    getFactoryStatus.mockResolvedValue({
      usage: {
        saasCount: 0,
        activeJobCount: 0,
        domainCount: 1,
      },
      limits: {
        saasRemaining: 5,
        jobSlotsRemaining: 3,
        domainsRemaining: 9,
      },
    });

    const incidents = await getFactoryIncidents("tenant_owner");

    expect(incidents.items.map((incident) => incident.id)).toEqual([
      "domain_failed_fresh.drako.systems",
      "job_failed_job_old",
    ]);
  });

  it("computes a stable summary from the returned incident list", async () => {
    const { getFactoryIncidents, queryAll, getFactoryStatus } = await loadSubject();

    queryAll
      .mockResolvedValueOnce([
        {
          job_id: "job_failed",
          entity_id: "saas_failed",
          current_state: "FAILED",
          correlation_id: "corr_failed",
          created_at: "2026-03-10T10:00:00.000Z",
          updated_at: "2026-03-10T10:05:00.000Z",
          last_error: "fatal create failure",
        },
        {
          job_id: "job_degraded",
          entity_id: "saas_degraded",
          current_state: "DEGRADED",
          correlation_id: "corr_degraded",
          created_at: "2026-03-10T09:00:00.000Z",
          updated_at: "2026-03-10T09:04:00.000Z",
          last_error: "verify pending",
        },
      ])
      .mockResolvedValueOnce([
        {
          domain: "pending.drako.systems",
          saas_id: "saas_pending",
          status: "pending",
          created_at: "2026-03-10T08:00:00.000Z",
          updated_at: "2026-03-10T08:03:00.000Z",
          last_error: null,
        },
      ]);
    getFactoryStatus.mockResolvedValue({
      usage: {
        saasCount: 5,
        activeJobCount: 3,
        domainCount: 10,
      },
      limits: {
        saasRemaining: 0,
        jobSlotsRemaining: 1,
        domainsRemaining: 0,
      },
    });

    const incidents = await getFactoryIncidents("tenant_owner");

    expect(incidents.summary).toEqual({
      total: 5,
      critical: 1,
      high: 1,
      medium: 3,
      low: 0,
    });
  });

  it("applies the requested limit to the final incident list", async () => {
    const { getFactoryIncidents, queryAll, getFactoryStatus } = await loadSubject();

    queryAll
      .mockResolvedValueOnce([
        {
          job_id: "job_a",
          entity_id: "saas_a",
          current_state: "FAILED",
          correlation_id: "corr_a",
          created_at: "2026-03-10T10:00:00.000Z",
          updated_at: "2026-03-10T10:05:00.000Z",
          last_error: "error a",
        },
        {
          job_id: "job_b",
          entity_id: "saas_b",
          current_state: "DEGRADED",
          correlation_id: "corr_b",
          created_at: "2026-03-10T09:00:00.000Z",
          updated_at: "2026-03-10T09:04:00.000Z",
          last_error: "error b",
        },
      ])
      .mockResolvedValueOnce([
        {
          domain: "c.drako.systems",
          saas_id: "saas_c",
          status: "failed",
          created_at: "2026-03-10T08:00:00.000Z",
          updated_at: "2026-03-10T08:03:00.000Z",
          last_error: "error c",
        },
      ]);
    getFactoryStatus.mockResolvedValue({
      usage: {
        saasCount: 0,
        activeJobCount: 0,
        domainCount: 1,
      },
      limits: {
        saasRemaining: 5,
        jobSlotsRemaining: 3,
        domainsRemaining: 9,
      },
    });

    const incidents = await getFactoryIncidents("tenant_owner", { limit: 2 });

    expect(incidents.limit).toBe(2);
    expect(incidents.items).toHaveLength(2);
  });

  it("uses the default limit for invalid low values", async () => {
    const { getFactoryIncidents, queryAll, getFactoryStatus } = await loadSubject();

    queryAll.mockResolvedValue([]);
    getFactoryStatus.mockResolvedValue({
      usage: {
        saasCount: 0,
        activeJobCount: 0,
        domainCount: 0,
      },
      limits: {
        saasRemaining: 5,
        jobSlotsRemaining: 3,
        domainsRemaining: 10,
      },
    });

    const incidents = await getFactoryIncidents("tenant_owner", { limit: 0 });

    expect(incidents.limit).toBe(20);
    expect(queryAll).toHaveBeenNthCalledWith(1, expect.any(String), "tenant_owner", 20);
    expect(queryAll).toHaveBeenNthCalledWith(2, expect.any(String), "tenant_owner", 20);
  });

  it("respects the maximum supported limit", async () => {
    const { getFactoryIncidents, queryAll, getFactoryStatus } = await loadSubject();

    queryAll.mockResolvedValue([]);
    getFactoryStatus.mockResolvedValue({
      usage: {
        saasCount: 0,
        activeJobCount: 0,
        domainCount: 0,
      },
      limits: {
        saasRemaining: 5,
        jobSlotsRemaining: 3,
        domainsRemaining: 10,
      },
    });

    const incidents = await getFactoryIncidents("tenant_owner", { limit: 999 });

    expect(incidents.limit).toBe(100);
    expect(queryAll).toHaveBeenNthCalledWith(1, expect.any(String), "tenant_owner", 100);
    expect(queryAll).toHaveBeenNthCalledWith(2, expect.any(String), "tenant_owner", 100);
  });

  it("uses the default limit when options are missing", async () => {
    const { getFactoryIncidents, queryAll, getFactoryStatus } = await loadSubject();

    queryAll.mockResolvedValue([]);
    getFactoryStatus.mockResolvedValue({
      usage: {
        saasCount: 0,
        activeJobCount: 0,
        domainCount: 0,
      },
      limits: {
        saasRemaining: 5,
        jobSlotsRemaining: 3,
        domainsRemaining: 10,
      },
    });

    const incidents = await getFactoryIncidents("tenant_owner");

    expect(incidents.limit).toBe(20);
    expect(queryAll).toHaveBeenNthCalledWith(1, expect.any(String), "tenant_owner", 20);
    expect(queryAll).toHaveBeenNthCalledWith(2, expect.any(String), "tenant_owner", 20);
  });
});
