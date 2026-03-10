import { queryAll } from "@/lib/db";

type ProvisioningJobRow = {
  job_id: string;
  entity_id: string | null;
  current_state: string;
  correlation_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_error: string | null;
};

type SaasDomainRow = {
  domain: string;
  saas_id: string | null;
  status: string;
  updated_at: string | null;
};

export type FactoryTrendJob = {
  jobId: string;
  saasId: string | null;
  state: string;
  correlationId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastError: string | null;
};

export type FactoryTrendDomain = {
  domain: string;
  saasId: string | null;
  status: string;
  updatedAt: string | null;
};

export type FactoryTrendFailure = {
  jobId: string;
  saasId: string | null;
  state: string;
  correlationId: string | null;
  updatedAt: string | null;
  lastError: string | null;
};

export type FactoryTrends = {
  limit: number;
  recentJobs: FactoryTrendJob[];
  recentDomains: FactoryTrendDomain[];
  recentFailures: FactoryTrendFailure[];
  summary: {
    totalRecentFailed: number;
    totalRecentDegraded: number;
    totalRecentSucceeded: number;
  };
  trendFlags: {
    failing: boolean;
    degraded: boolean;
    recovering: boolean;
  };
};

const DEFAULT_LIMIT = 10;
const MIN_LIMIT = 1;
const MAX_LIMIT = 50;

function normalizeLimit(limit?: number | null): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  const value = Math.trunc(limit as number);
  if (value < MIN_LIMIT || value > MAX_LIMIT) {
    return value > MAX_LIMIT ? MAX_LIMIT : DEFAULT_LIMIT;
  }
  return value;
}

function mapJob(row: ProvisioningJobRow): FactoryTrendJob {
  return {
    jobId: row.job_id,
    saasId: row.entity_id,
    state: row.current_state,
    correlationId: row.correlation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastError: row.last_error,
  };
}

function mapDomain(row: SaasDomainRow): FactoryTrendDomain {
  return {
    domain: row.domain,
    saasId: row.saas_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export async function getFactoryTrends(
  tenantId: string,
  options?: {
    limit?: number | null;
  },
): Promise<FactoryTrends> {
  const limit = normalizeLimit(options?.limit);

  const [recentJobRows, recentDomainRows] = await Promise.all([
    queryAll<ProvisioningJobRow>(
      `SELECT job_id,
              entity_id,
              current_state,
              correlation_id,
              created_at,
              updated_at,
              last_error
       FROM provisioning_jobs
       WHERE tenant_id = ?
       ORDER BY updated_at DESC
       LIMIT ?`,
      tenantId,
      limit,
    ),
    queryAll<SaasDomainRow>(
      `SELECT domain,
              saas_id,
              status,
              updated_at
       FROM saas_domains
       WHERE tenant_id = ?
       ORDER BY updated_at DESC
       LIMIT ?`,
      tenantId,
      limit,
    ),
  ]);

  const recentJobs = recentJobRows.map(mapJob);
  const recentDomains = recentDomainRows.map(mapDomain);
  const recentFailures = recentJobs
    .filter((job) => job.state === "FAILED")
    .map((job) => ({
      jobId: job.jobId,
      saasId: job.saasId,
      state: job.state,
      correlationId: job.correlationId,
      updatedAt: job.updatedAt,
      lastError: job.lastError,
    }));

  const summary = {
    totalRecentFailed: recentJobs.filter((job) => job.state === "FAILED").length,
    totalRecentDegraded: recentJobs.filter((job) => job.state === "DEGRADED").length,
    totalRecentSucceeded: recentJobs.filter((job) => job.state === "SUCCESS").length,
  };

  return {
    limit,
    recentJobs,
    recentDomains,
    recentFailures,
    summary,
    trendFlags: {
      failing: summary.totalRecentFailed > 0,
      degraded: summary.totalRecentDegraded > 0,
      recovering:
        summary.totalRecentFailed === 0 &&
        summary.totalRecentDegraded === 0 &&
        summary.totalRecentSucceeded > 0,
    },
  };
}
