import { queryAll } from "@/lib/db";
import { getFactoryStatus } from "@/lib/factory/status";

type ProvisioningIncidentRow = {
  job_id: string;
  entity_id: string | null;
  current_state: string;
  correlation_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_error: string | null;
};

type DomainIncidentRow = {
  domain: string;
  saas_id: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  last_error?: string | null;
};

export type FactoryIncidentKind =
  | "JOB_FAILED"
  | "JOB_DEGRADED"
  | "DOMAIN_PENDING"
  | "DOMAIN_FAILED"
  | "QUOTA_PRESSURE";

export type FactoryIncidentSeverity = "critical" | "high" | "medium" | "low";

export type FactoryIncident = {
  id: string;
  kind: FactoryIncidentKind;
  severity: FactoryIncidentSeverity;
  title: string;
  message: string;
  relatedJobId: string | null;
  relatedSaasId: string | null;
  relatedDomain: string | null;
  state: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  metadata?: Record<string, unknown>;
};

export type FactoryIncidentFeed = {
  limit: number;
  items: FactoryIncident[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
};

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

function normalizeLimit(limit?: number | null): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  const value = Math.trunc(limit as number);
  if (value < MIN_LIMIT) return DEFAULT_LIMIT;
  if (value > MAX_LIMIT) return MAX_LIMIT;
  return value;
}

function timestampForSort(incident: FactoryIncident): string {
  return incident.updatedAt ?? incident.createdAt ?? "";
}

function compareByRecencyDesc(left: FactoryIncident, right: FactoryIncident): number {
  const leftTs = timestampForSort(left);
  const rightTs = timestampForSort(right);
  if (leftTs === rightTs) return left.id.localeCompare(right.id);
  if (!leftTs) return 1;
  if (!rightTs) return -1;
  return rightTs.localeCompare(leftTs);
}

function buildJobIncident(row: ProvisioningIncidentRow): FactoryIncident {
  const isFailed = row.current_state === "FAILED";

  return {
    id: `${isFailed ? "job_failed" : "job_degraded"}_${row.job_id}`,
    kind: isFailed ? "JOB_FAILED" : "JOB_DEGRADED",
    severity: isFailed ? "critical" : "high",
    title: isFailed ? "Provisioning job failed" : "Provisioning job degraded",
    message: isFailed
      ? `Job ${row.job_id} failed during provisioning.`
      : `Job ${row.job_id} completed in degraded mode.`,
    relatedJobId: row.job_id,
    relatedSaasId: row.entity_id,
    relatedDomain: null,
    state: row.current_state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: {
      correlationId: row.correlation_id,
      lastError: row.last_error,
    },
  };
}

function buildDomainIncident(row: DomainIncidentRow): FactoryIncident {
  const normalizedStatus = row.status.toLowerCase();
  const isFailed = normalizedStatus === "failed";
  const kind: FactoryIncidentKind = isFailed ? "DOMAIN_FAILED" : "DOMAIN_PENDING";

  return {
    id: `${isFailed ? "domain_failed" : "domain_pending"}_${row.domain}`,
    kind,
    severity: isFailed ? "high" : "medium",
    title: isFailed ? "Domain provisioning failed" : "Domain still pending",
    message: isFailed
      ? `Domain ${row.domain} is marked as failed.`
      : `Domain ${row.domain} is still ${normalizedStatus}.`,
    relatedJobId: null,
    relatedSaasId: row.saas_id,
    relatedDomain: row.domain,
    state: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.last_error ? { lastError: row.last_error } : undefined,
  };
}

function buildQuotaPressureIncidents(status: Awaited<ReturnType<typeof getFactoryStatus>>): FactoryIncident[] {
  if (!status.limits) return [];

  const incidents: FactoryIncident[] = [];

  if (status.limits.jobSlotsRemaining === 0) {
    incidents.push({
      id: "quota_pressure_jobs",
      kind: "QUOTA_PRESSURE",
      severity: "medium",
      title: "Factory job capacity exhausted",
      message: "No concurrent provisioning job slots remain for this tenant.",
      relatedJobId: null,
      relatedSaasId: null,
      relatedDomain: null,
      state: null,
      createdAt: null,
      updatedAt: null,
      metadata: {
        activeJobCount: status.usage.activeJobCount,
        remaining: status.limits.jobSlotsRemaining,
      },
    });
  }

  if (status.limits.saasRemaining === 0) {
    incidents.push({
      id: "quota_pressure_saas",
      kind: "QUOTA_PRESSURE",
      severity: "medium",
      title: "SaaS quota exhausted",
      message: "No SaaS creation capacity remains for this tenant plan.",
      relatedJobId: null,
      relatedSaasId: null,
      relatedDomain: null,
      state: null,
      createdAt: null,
      updatedAt: null,
      metadata: {
        saasCount: status.usage.saasCount,
        remaining: status.limits.saasRemaining,
      },
    });
  }

  if (status.limits.domainsRemaining === 0) {
    incidents.push({
      id: "quota_pressure_domains",
      kind: "QUOTA_PRESSURE",
      severity: "medium",
      title: "Domain quota exhausted",
      message: "No domain capacity remains for this tenant plan.",
      relatedJobId: null,
      relatedSaasId: null,
      relatedDomain: null,
      state: null,
      createdAt: null,
      updatedAt: null,
      metadata: {
        domainCount: status.usage.domainCount,
        remaining: status.limits.domainsRemaining,
      },
    });
  }

  return incidents;
}

export async function getFactoryIncidents(
  tenantId: string,
  options?: {
    limit?: number | null;
  },
): Promise<FactoryIncidentFeed> {
  const limit = normalizeLimit(options?.limit);

  const [jobRows, domainRows, status] = await Promise.all([
    queryAll<ProvisioningIncidentRow>(
      `SELECT job_id,
              entity_id,
              current_state,
              correlation_id,
              created_at,
              updated_at,
              last_error
       FROM provisioning_jobs
       WHERE tenant_id = ?
         AND current_state IN ('FAILED', 'DEGRADED')
       ORDER BY updated_at DESC
       LIMIT ?`,
      tenantId,
      limit,
    ),
    queryAll<DomainIncidentRow>(
      `SELECT domain,
              saas_id,
              status,
              created_at,
              updated_at,
              last_error
       FROM saas_domains
       WHERE tenant_id = ?
         AND lower(status) IN ('failed', 'pending', 'provisioning')
       ORDER BY updated_at DESC
       LIMIT ?`,
      tenantId,
      limit,
    ),
    getFactoryStatus(tenantId),
  ]);

  const items = [
    ...jobRows.map(buildJobIncident),
    ...domainRows.map(buildDomainIncident),
    ...buildQuotaPressureIncidents(status),
  ]
    .sort(compareByRecencyDesc)
    .slice(0, limit);

  const summary = items.reduce(
    (acc, incident) => {
      acc.total += 1;
      acc[incident.severity] += 1;
      return acc;
    },
    {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
  );

  return {
    limit,
    items,
    summary,
  };
}
