import { queryAll, queryOne } from "@/lib/db";

export type CanonicalSaasSummary = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  saasStatus: string;
  instanceStatus: string | null;
  domain: string | null;
  domainStatus: string | null;
  provisioningStatus: string | null;
  updatedAt: string | null;
};

export type CanonicalProvisioningJobSummary = {
  jobId: string;
  saasId: string | null;
  state: string;
  updatedAt: string | null;
};

export type CanonicalFactoryOverview = {
  counts: {
    activeSaas: number;
    provisioningRunning: number;
    degradedJobs: number;
    activeDomains: number;
  };
  saases: CanonicalSaasSummary[];
  jobs: CanonicalProvisioningJobSummary[];
};

export async function findCanonicalSaasBySlug(slug: string): Promise<CanonicalSaasSummary | null> {
  return queryOne<CanonicalSaasSummary>(
    `SELECT s.id,
            s.tenant_id AS tenantId,
            s.name,
            s.slug,
            s.status AS saasStatus,
            i.status AS instanceStatus,
            COALESCE(d.domain, i.custom_domain, i.trial_domain, s.public_domain, s.domain) AS domain,
            COALESCE(d.status, i.domain_status, s.domain_status) AS domainStatus,
            p.status AS provisioningStatus,
            COALESCE(i.updated_at, s.updated_at, s.created_at) AS updatedAt
     FROM saas s
     LEFT JOIN saas_instances i ON i.id = s.id
     LEFT JOIN saas_domains d
       ON d.saas_id = s.id AND d.tenant_id = s.tenant_id AND d.is_primary = 1
     LEFT JOIN campamento_provisioning p
       ON p.saas_id = s.id AND p.tenant_id = s.tenant_id
     WHERE lower(s.slug) = lower(?)
     LIMIT 1`,
    slug,
  );
}

export async function listCanonicalSaasForTenant(tenantId: string, limit = 6): Promise<CanonicalSaasSummary[]> {
  return queryAll<CanonicalSaasSummary>(
    `SELECT s.id,
            s.tenant_id AS tenantId,
            s.name,
            s.slug,
            s.status AS saasStatus,
            i.status AS instanceStatus,
            COALESCE(d.domain, i.custom_domain, i.trial_domain, s.public_domain, s.domain) AS domain,
            COALESCE(d.status, i.domain_status, s.domain_status) AS domainStatus,
            p.status AS provisioningStatus,
            COALESCE(i.updated_at, s.updated_at, s.created_at) AS updatedAt
     FROM saas s
     LEFT JOIN saas_instances i ON i.id = s.id
     LEFT JOIN saas_domains d
       ON d.saas_id = s.id AND d.tenant_id = s.tenant_id AND d.is_primary = 1
     LEFT JOIN campamento_provisioning p
       ON p.saas_id = s.id AND p.tenant_id = s.tenant_id
     WHERE s.tenant_id = ?
     ORDER BY COALESCE(i.updated_at, s.updated_at, s.created_at) DESC
     LIMIT ?`,
    tenantId,
    limit,
  );
}

export async function listRecentProvisioningJobsForTenant(tenantId: string, limit = 5): Promise<CanonicalProvisioningJobSummary[]> {
  return queryAll<CanonicalProvisioningJobSummary>(
    `SELECT job_id AS jobId,
            entity_id AS saasId,
            current_state AS state,
            updated_at AS updatedAt
     FROM provisioning_jobs
     WHERE tenant_id = ?
       AND type = 'SAAS_PROVISIONING'
     ORDER BY updated_at DESC
     LIMIT ?`,
    tenantId,
    limit,
  );
}

export async function getCanonicalFactoryOverview(tenantId: string): Promise<CanonicalFactoryOverview> {
  const [activeSaas, provisioningRunning, degradedJobs, activeDomains, saases, jobs] = await Promise.all([
    queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM saas WHERE tenant_id = ? AND status = 'active'`, tenantId),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM provisioning_jobs
       WHERE tenant_id = ?
         AND type = 'SAAS_PROVISIONING'
         AND current_state IN ('CREATED','RUNNING','SAAS_REGISTERED','STRIPE_PRODUCT_CREATED','RUNTIME_DEPLOYED','PROVISION_WORKER','CREATE_DOMAIN_BINDING','VERIFY_DOMAIN','BOOTSTRAP_READY','CUSTOM_DOMAIN_READY')`,
      tenantId,
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM provisioning_jobs
       WHERE tenant_id = ?
         AND type = 'SAAS_PROVISIONING'
         AND current_state = 'DEGRADED'`,
      tenantId,
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM saas_domains
       WHERE tenant_id = ?
         AND is_primary = 1
         AND status = 'active'`,
      tenantId,
    ),
    listCanonicalSaasForTenant(tenantId, 6),
    listRecentProvisioningJobsForTenant(tenantId, 5),
  ]);

  return {
    counts: {
      activeSaas: Number(activeSaas?.count ?? 0),
      provisioningRunning: Number(provisioningRunning?.count ?? 0),
      degradedJobs: Number(degradedJobs?.count ?? 0),
      activeDomains: Number(activeDomains?.count ?? 0),
    },
    saases,
    jobs,
  };
}
