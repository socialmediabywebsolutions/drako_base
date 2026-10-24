import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const queryAll = vi.fn();

  vi.doMock("@/lib/db", () => ({
    queryAll,
  }));

  const { getFactoryTrends } = await import("@/lib/factory/trends");

  return {
    getFactoryTrends,
    queryAll,
  };
}

describe("getFactoryTrends", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns recent jobs and domains in the same most-recent-first order from the datastore", async () => {
    const { getFactoryTrends, queryAll } = await loadSubject();

    queryAll
      .mockResolvedValueOnce([
        {
          job_id: "job_3",
          entity_id: "saas_3",
          current_state: "FAILED",
          correlation_id: "corr_3",
          created_at: "2026-03-10T10:00:00.000Z",
          updated_at: "2026-03-10T10:05:00.000Z",
          last_error: "fatal create failure",
        },
        {
          job_id: "job_2",
          entity_id: "saas_2",
          current_state: "DEGRADED",
          correlation_id: "corr_2",
          created_at: "2026-03-10T09:00:00.000Z",
          updated_at: "2026-03-10T09:04:00.000Z",
          last_error: "verify pending",
        },
        {
          job_id: "job_1",
          entity_id: "saas_1",
          current_state: "SUCCESS",
          correlation_id: "corr_1",
          created_at: "2026-03-10T08:00:00.000Z",
          updated_at: "2026-03-10T08:03:00.000Z",
          last_error: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          domain: "three.drako.systems",
          saas_id: "saas_3",
          status: "failed",
          updated_at: "2026-03-10T10:05:00.000Z",
        },
        {
          domain: "two.drako.systems",
          saas_id: "saas_2",
          status: "pending",
          updated_at: "2026-03-10T09:04:00.000Z",
        },
      ]);

    const trends = await getFactoryTrends("tenant_owner", { limit: 3 });

    expect(queryAll).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("FROM provisioning_jobs"),
      "tenant_owner",
      3,
    );
    expect(queryAll).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("FROM saas_domains"),
      "tenant_owner",
      3,
    );
    expect(trends.recentJobs.map((job) => job.jobId)).toEqual(["job_3", "job_2", "job_1"]);
    expect(trends.recentDomains.map((domain) => domain.domain)).toEqual([
      "three.drako.systems",
      "two.drako.systems",
    ]);
  });

  it("derives recent failures, summary and trend flags from recent jobs", async () => {
    const { getFactoryTrends, queryAll } = await loadSubject();

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
        {
          job_id: "job_success",
          entity_id: "saas_success",
          current_state: "SUCCESS",
          correlation_id: "corr_success",
          created_at: "2026-03-10T08:00:00.000Z",
          updated_at: "2026-03-10T08:03:00.000Z",
          last_error: null,
        },
      ])
      .mockResolvedValueOnce([]);

    const trends = await getFactoryTrends("tenant_owner", { limit: 10 });

    expect(trends.recentFailures).toEqual([
      {
        jobId: "job_failed",
        saasId: "saas_failed",
        state: "FAILED",
        correlationId: "corr_failed",
        updatedAt: "2026-03-10T10:05:00.000Z",
        lastError: "fatal create failure",
      },
    ]);
    expect(trends.summary).toEqual({
      totalRecentFailed: 1,
      totalRecentDegraded: 1,
      totalRecentSucceeded: 1,
    });
    expect(trends.trendFlags).toEqual({
      failing: true,
      degraded: true,
      recovering: false,
    });
  });

  it("marks trends as recovering when recent jobs only show successful completions", async () => {
    const { getFactoryTrends, queryAll } = await loadSubject();

    queryAll
      .mockResolvedValueOnce([
        {
          job_id: "job_success_2",
          entity_id: "saas_2",
          current_state: "SUCCESS",
          correlation_id: "corr_2",
          created_at: "2026-03-10T10:00:00.000Z",
          updated_at: "2026-03-10T10:05:00.000Z",
          last_error: null,
        },
        {
          job_id: "job_success_1",
          entity_id: "saas_1",
          current_state: "SUCCESS",
          correlation_id: "corr_1",
          created_at: "2026-03-10T09:00:00.000Z",
          updated_at: "2026-03-10T09:02:00.000Z",
          last_error: null,
        },
      ])
      .mockResolvedValueOnce([]);

    const trends = await getFactoryTrends("tenant_owner");

    expect(trends.limit).toBe(10);
    expect(trends.summary).toEqual({
      totalRecentFailed: 0,
      totalRecentDegraded: 0,
      totalRecentSucceeded: 2,
    });
    expect(trends.trendFlags).toEqual({
      failing: false,
      degraded: false,
      recovering: true,
    });
  });

  it("falls back to the default limit for invalid low values", async () => {
    const { getFactoryTrends, queryAll } = await loadSubject();

    queryAll.mockResolvedValue([]);

    const trends = await getFactoryTrends("tenant_owner", { limit: 0 });

    expect(trends.limit).toBe(10);
    expect(queryAll).toHaveBeenNthCalledWith(1, expect.any(String), "tenant_owner", 10);
    expect(queryAll).toHaveBeenNthCalledWith(2, expect.any(String), "tenant_owner", 10);
  });

  it("uses the default limit when options are missing", async () => {
    const { getFactoryTrends, queryAll } = await loadSubject();

    queryAll.mockResolvedValue([]);

    const trends = await getFactoryTrends("tenant_owner");

    expect(trends.limit).toBe(10);
    expect(queryAll).toHaveBeenNthCalledWith(1, expect.any(String), "tenant_owner", 10);
    expect(queryAll).toHaveBeenNthCalledWith(2, expect.any(String), "tenant_owner", 10);
  });

  it("caps limit to the supported maximum", async () => {
    const { getFactoryTrends, queryAll } = await loadSubject();

    queryAll.mockResolvedValue([]);

    const trends = await getFactoryTrends("tenant_owner", { limit: 99 });

    expect(trends.limit).toBe(50);
    expect(queryAll).toHaveBeenNthCalledWith(1, expect.any(String), "tenant_owner", 50);
    expect(queryAll).toHaveBeenNthCalledWith(2, expect.any(String), "tenant_owner", 50);
  });
});
