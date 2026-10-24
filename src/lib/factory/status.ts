import { queryOne } from "@/lib/db";
import { getFactoryBillingState, type FactoryQuota } from "@/lib/billing/factory-billing";

type CountRow = {
  count: number | string;
};

type FactoryJobStatus = {
  created: number;
  running: number;
  degraded: number;
  failed: number;
  succeeded: number;
};

type FactoryDomainStatus = {
  pending: number;
  provisioning: number;
  active: number;
  failed: number;
};

type FactoryLimits = {
  saasRemaining: number | null;
  jobSlotsRemaining: number | null;
  domainsRemaining: number | null;
};

export type FactoryStatus = {
  activeSaas: number;
  jobs: FactoryJobStatus;
  domains: FactoryDomainStatus;
  usage: {
    saasCount: number;
    activeJobCount: number;
    domainCount: number;
  };
  slo: {
    degraded: boolean;
    failing: boolean;
  };
  quota?: FactoryQuota;
  limits?: FactoryLimits;
};

function normalizeCount(value: unknown): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

async function countForTenant(sql: string, tenantId: string): Promise<number> {
  const row = await queryOne<CountRow>(sql, tenantId);
  return normalizeCount(row?.count);
}

function computeRemaining(limit: number, used: number): number | null {
  if (!Number.isFinite(limit)) return null;
  return Math.max(0, Math.trunc(limit - used));
}

export async function getFactoryStatus(tenantId: string): Promise<FactoryStatus> {
  const [
    jobsCreated,
    jobsRunning,
    jobsDegraded,
    jobsFailed,
    jobsSucceeded,
    pendingDomains,
    provisioningDomains,
    activeDomains,
    failedDomains,
    factoryBilling,
  ] = await Promise.all([
    countForTenant("SELECT COUNT(*) AS count FROM provisioning_jobs WHERE tenant_id = ? AND current_state = 'CREATED'", tenantId),
    countForTenant("SELECT COUNT(*) AS count FROM provisioning_jobs WHERE tenant_id = ? AND current_state = 'RUNNING'", tenantId),
    countForTenant("SELECT COUNT(*) AS count FROM provisioning_jobs WHERE tenant_id = ? AND current_state = 'DEGRADED'", tenantId),
    countForTenant("SELECT COUNT(*) AS count FROM provisioning_jobs WHERE tenant_id = ? AND current_state = 'FAILED'", tenantId),
    countForTenant("SELECT COUNT(*) AS count FROM provisioning_jobs WHERE tenant_id = ? AND current_state = 'SUCCESS'", tenantId),
    countForTenant("SELECT COUNT(*) AS count FROM saas_domains WHERE tenant_id = ? AND lower(status) = 'pending'", tenantId),
    countForTenant("SELECT COUNT(*) AS count FROM saas_domains WHERE tenant_id = ? AND lower(status) = 'provisioning'", tenantId),
    countForTenant("SELECT COUNT(*) AS count FROM saas_domains WHERE tenant_id = ? AND lower(status) = 'active'", tenantId),
    countForTenant("SELECT COUNT(*) AS count FROM saas_domains WHERE tenant_id = ? AND lower(status) = 'failed'", tenantId),
    getFactoryBillingState(tenantId),
  ]);

  const usage = factoryBilling.usage;
  const activeSaas = usage.saasCount;

  const status: FactoryStatus = {
    activeSaas,
    jobs: {
      created: jobsCreated,
      running: jobsRunning,
      degraded: jobsDegraded,
      failed: jobsFailed,
      succeeded: jobsSucceeded,
    },
    domains: {
      pending: pendingDomains,
      provisioning: provisioningDomains,
      active: activeDomains,
      failed: failedDomains,
    },
    usage,
    slo: {
      degraded: jobsDegraded > 0,
      failing: jobsFailed > 0,
    },
  };

  if (!factoryBilling.quota) {
    return status;
  }

  status.quota = factoryBilling.quota;
  status.limits = factoryBilling.limits ?? {
    saasRemaining: computeRemaining(factoryBilling.quota.maxSaas, activeSaas),
    jobSlotsRemaining: computeRemaining(factoryBilling.quota.maxConcurrentJobs, usage.activeJobCount),
    domainsRemaining: computeRemaining(factoryBilling.quota.maxDomains, usage.domainCount),
  };

  return status;
}
