import { expect, vi } from "vitest";
import { processQueueBatch } from "../../workers/drako-scheduler/src/consumer";

type QueueMessage = {
  jobId: string;
  type: string;
  correlationId: string;
  tenantId: string;
};

// This harness only implements the D1 subset exercised by the canonical
// create-saas flow. Keeping it narrow makes the integration contract explicit.

type ProvisioningJobRecord = {
  job_id: string;
  type: string;
  entity_id: string;
  correlation_id: string;
  idempotency_key: string;
  current_state: string;
  payload_json: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  execution_lock: number;
  lock_acquired_at: string | null;
  lock_owner: string | null;
  lock_version: number;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  step_history_json: string;
  rollback_history_json: string;
};

type SaasRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  domain: string | null;
  subdomain: string | null;
  public_domain: string | null;
  public_subdomain: string | null;
  domain_status: string | null;
  tenant_id: string;
  created_at: string;
};

type SaasInstanceRow = {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  status: string;
  trial_domain: string | null;
  custom_domain: string | null;
  domain_status: string | null;
  plan_tier: string;
  created_at: string;
  updated_at: string;
};

type SaasDomainRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  domain: string;
  is_primary: number;
  status: string;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

type CampamentoEventRow = {
  id: string;
  tenant_id: string;
  saas_id: string | null;
  type: string;
  severity: string;
  source: string;
  message: string;
  metadata: string | null;
  correlation_id: string;
  created_at: string;
};

type CampamentoProvisioningRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  mode: string;
  status: string;
  plan: string;
  last_error: string | null;
  correlation_id: string;
  created_at: string;
  updated_at: string;
};

type SaasBrandingSettingsRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  metadata: string | null;
};

type SaasFeatureRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  feature_key: string;
  label: string;
  category: string;
  status: string;
  source: string;
  phase_order: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type SocialAccountRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  provider: string;
  handle: string | null;
  display_name: string | null;
  status: string;
  auth_meta: string | null;
  primary: number;
  created_at: string;
  updated_at: string;
};

type SocialCampaignRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  objective: string;
  status: string;
  target_segment: string;
  start_date: string | null;
  end_date: string | null;
  budget_estimate: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SocialPostRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  campaign_id: string | null;
  provider: string;
  content_type: string;
  title: string;
  body: string;
  image_hint: string | null;
  status: string;
  scheduled_at: string | null;
  posted_at: string | null;
  external_post_id: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type SocialMetricRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  post_id: string;
  provider: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  leads_generated: number;
  captured_at: string;
  metadata: string | null;
};

type TaskRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  title: string;
  description: string | null;
  category: string;
  source: string;
  status: string;
  severity: string;
  assignee_employee_id: string | null;
  due_date: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type TaskEventRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  task_id: string;
  type: string;
  payload: string | null;
  created_at: string;
};

export type ProvisioningHarnessStore = {
  owners: Array<{ id: string; tenant_id: string }>;
  tenants: Array<{ id: string; saas_slug: string | null; plan: string }>;
  saasSubscriptions: Array<{
    id: string;
    tenant_id: string;
    saas_slug: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    plan_code: string | null;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: number;
    updated_at: string;
  }>;
  saasUsageQuotas: Array<{
    tenant_id: string;
    saas_slug: string;
    quota_key: string;
    limit_value: number;
  }>;
  provisioningJobs: ProvisioningJobRecord[];
  saas: SaasRow[];
  saasInstances: SaasInstanceRow[];
  saasDomains: SaasDomainRow[];
  campamentoProvisioning: CampamentoProvisioningRow[];
  saasBrandingSettings: SaasBrandingSettingsRow[];
  saasFeatures: SaasFeatureRow[];
  socialAccounts: SocialAccountRow[];
  socialCampaigns: SocialCampaignRow[];
  socialPosts: SocialPostRow[];
  socialMetrics: SocialMetricRow[];
  tasks: TaskRow[];
  taskEvents: TaskEventRow[];
  campamentoEvents: CampamentoEventRow[];
  sentQueueMessages: QueueMessage[];
};

type CreateSaasQueueEnv = {
  DRACO_DB: unknown;
  PROVISIONING_QUEUE: {
    send: (message: QueueMessage) => Promise<void>;
  };
  DRAKO_BASE_DOMAIN: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ZONE_ID: string;
  PROVISION_DOMAIN_VERIFY_RETRIES: string;
  PROVISION_DOMAIN_VERIFY_BACKOFF_MS: string;
  PROVISION_DOMAIN_VERIFY_MAX_BACKOFF_MS: string;
  PROVISION_DOMAIN_VERIFY_JITTER_MS: string;
  PROVISION_DOMAIN_VERIFY_TIMEOUT_MS: string;
  PROVISIONING_FAULT_AT?: "BOOTSTRAP_PARTIAL_READY" | "BOOTSTRAP_CONSISTENCY_BREAK" | "CUSTOM_DOMAIN_CONSISTENCY_BREAK";
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function lower(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function hasSql(normalized: string, ...patterns: string[]): boolean {
  return patterns.every((pattern) => normalized.includes(pattern));
}

function selectProvisioningJob(
  store: ProvisioningHarnessStore,
  predicate: (row: ProvisioningJobRecord) => boolean,
  mapper: (row: ProvisioningJobRecord) => unknown,
): unknown[] {
  return store.provisioningJobs.filter(predicate).slice(0, 1).map(mapper);
}

function appendJsonHistory(current: string, entryJson: unknown): string {
  const history = parseJsonArray<Record<string, unknown>>(current);
  history.push(JSON.parse(String(entryJson)));
  return JSON.stringify(history);
}

function selectRows(store: ProvisioningHarnessStore, sql: string, params: unknown[]): unknown[] {
  const normalized = normalizeSql(sql);

  if (hasSql(normalized, "from owners", "where tenant_id = ?")) {
    const [tenantId] = params;
    return store.owners
      .filter((row) => row.tenant_id === tenantId)
      .slice(0, 1)
      .map((row) => ({ id: row.id }));
  }

  if (hasSql(normalized, "select saas_slug from tenants")) {
    const [tenantId] = params;
    return store.tenants
      .filter((row) => row.id === tenantId)
      .slice(0, 1)
      .map((row) => ({ saas_slug: row.saas_slug }));
  }

  if (hasSql(normalized, "select plan from tenants")) {
    const [tenantId] = params;
    return store.tenants
      .filter((row) => row.id === tenantId)
      .slice(0, 1)
      .map((row) => ({ plan: row.plan }));
  }

  if (hasSql(normalized, "select id", "from saas_domains", "lower(domain) = lower(?)")) {
    const [domain] = params;
    return store.saasDomains
      .filter((row) => lower(row.domain) === lower(domain))
      .slice(0, 1)
      .map((row) => ({ id: row.id }));
  }

  if (hasSql(normalized, "from saas_subscriptions")) {
    const [tenantId, saasSlug] = params;
    if (typeof saasSlug === "undefined") {
      return store.saasSubscriptions
        .filter((row) => row.tenant_id === tenantId)
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
        .slice(0, 1)
        .map((row) => ({
          ...row,
          plan: row.plan_code,
        }));
    }
    return store.saasSubscriptions
      .filter((row) => row.tenant_id === tenantId && row.saas_slug === saasSlug)
      .slice(0, 1);
  }

  if (hasSql(normalized, "select count(*) as count from saas where tenant_id = ?")) {
    const [tenantId] = params;
    return [{ count: store.saas.filter((row) => row.tenant_id === tenantId).length }];
  }

  if (hasSql(normalized, "select count(*) as count", "from provisioning_jobs", "current_state in ('created','running')")) {
    const [tenantId] = params;
    return [{
      count: store.provisioningJobs.filter(
        (row) => row.tenant_id === tenantId && ["CREATED", "RUNNING"].includes(row.current_state),
      ).length,
    }];
  }

  if (hasSql(normalized, "from saas_usage_quotas")) {
    const [tenantId, saasSlug] = params;
    return store.saasUsageQuotas.filter((row) => row.tenant_id === tenantId && row.saas_slug === saasSlug);
  }

  if (hasSql(normalized, "from provisioning_jobs where idempotency_key = ?")) {
    const [idempotencyKey] = params;
    return selectProvisioningJob(store, (row) => row.idempotency_key === idempotencyKey, (row) => ({
        job_id: row.job_id,
        current_state: row.current_state,
        entity_id: row.entity_id,
        payload_json: row.payload_json,
      }));
  }

  if (hasSql(normalized, "from provisioning_jobs where job_id = ?", "select lock_owner")) {
    const [jobId] = params;
    return selectProvisioningJob(store, (row) => row.job_id === jobId, (row) => ({
        lock_owner: row.lock_owner,
        lock_version: row.lock_version,
        retry_count: row.retry_count,
        max_retries: row.max_retries,
        current_state: row.current_state,
        lock_acquired_at: row.lock_acquired_at,
      }));
  }

  if (hasSql(normalized, "select payload_json from provisioning_jobs where job_id = ?")) {
    const [jobId] = params;
    return selectProvisioningJob(store, (row) => row.job_id === jobId, (row) => ({ payload_json: row.payload_json }));
  }

  if (hasSql(normalized, "select current_state, lock_version from provisioning_jobs where job_id = ?")) {
    const [jobId] = params;
    return selectProvisioningJob(
      store,
      (row) => row.job_id === jobId,
      (row) => ({ current_state: row.current_state, lock_version: row.lock_version }),
    );
  }

  if (hasSql(normalized, "select payload_json, tenant_id, current_state, entity_id, correlation_id, idempotency_key from provisioning_jobs where job_id = ?")) {
    const [jobId] = params;
    return selectProvisioningJob(store, (row) => row.job_id === jobId, (row) => ({
        payload_json: row.payload_json,
        tenant_id: row.tenant_id,
        current_state: row.current_state,
        entity_id: row.entity_id,
        correlation_id: row.correlation_id,
        idempotency_key: row.idempotency_key,
      }));
  }

  if (hasSql(normalized, "from provisioning_jobs", "where job_id = ?", "and tenant_id = ?")) {
    const [jobId, tenantId] = params;
    return selectProvisioningJob(store, (row) => row.job_id === jobId && row.tenant_id === tenantId, (row) => ({
        job_id: row.job_id,
        entity_id: row.entity_id,
        correlation_id: row.correlation_id,
        idempotency_key: row.idempotency_key,
        current_state: row.current_state,
        execution_lock: row.execution_lock,
        lock_owner: row.lock_owner,
        retry_count: row.retry_count,
        max_retries: row.max_retries,
        last_error: row.last_error,
        step_history_json: row.step_history_json,
        rollback_history_json: row.rollback_history_json,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
  }

  if (hasSql(normalized, "select status from saas_domains where tenant_id = ? and saas_id = ? and is_primary = 1")) {
    const [tenantId, saasId] = params;
    return store.saasDomains
      .filter((row) => row.tenant_id === tenantId && row.saas_id === saasId && row.is_primary === 1)
      .slice(0, 1)
      .map((row) => ({ status: row.status }));
  }

  if (hasSql(normalized, "select domain, is_primary, status", "from saas_domains", "where tenant_id = ? and saas_id = ? and lower(domain) = lower(?)")) {
    const [tenantId, saasId, domain] = params;
    return store.saasDomains
      .filter((row) => row.tenant_id === tenantId && row.saas_id === saasId && lower(row.domain) === lower(domain))
      .slice(0, 1)
      .map((row) => ({
        domain: row.domain,
        is_primary: row.is_primary,
        status: row.status,
      }));
  }

  if (hasSql(normalized, "select status, domain_status, domain, public_domain", "from saas", "where id = ? and tenant_id = ?")) {
    const [saasId, tenantId] = params;
    return store.saas
      .filter((row) => row.id === saasId && row.tenant_id === tenantId)
      .slice(0, 1)
      .map((row) => ({
        status: row.status,
        domain_status: row.domain_status,
        domain: row.domain,
        public_domain: row.public_domain,
      }));
  }

  if (hasSql(normalized, "select status, domain_status", "from saas", "where id = ? and tenant_id = ?")) {
    const [saasId, tenantId] = params;
    return store.saas
      .filter((row) => row.id === saasId && row.tenant_id === tenantId)
      .slice(0, 1)
      .map((row) => ({
        status: row.status,
        domain_status: row.domain_status,
      }));
  }

  if (hasSql(normalized, "select status, trial_domain, custom_domain, domain_status", "from saas_instances", "where id = ? and tenant_id = ?")) {
    const [saasId, tenantId] = params;
    return store.saasInstances
      .filter((row) => row.id === saasId && row.tenant_id === tenantId)
      .slice(0, 1)
      .map((row) => ({
        status: row.status,
        trial_domain: row.trial_domain,
        custom_domain: row.custom_domain,
        domain_status: row.domain_status,
      }));
  }

  if (hasSql(normalized, "select status, domain_status, plan_tier", "from saas_instances", "where id = ? and tenant_id = ?")) {
    const [saasId, tenantId] = params;
    return store.saasInstances
      .filter((row) => row.id === saasId && row.tenant_id === tenantId)
      .slice(0, 1)
      .map((row) => ({
        status: row.status,
        domain_status: row.domain_status,
        plan_tier: row.plan_tier,
      }));
  }

  if (
    hasSql(normalized, "select status", "from campamento_provisioning", "where tenant_id = ? and saas_id = ?")
    && !normalized.includes("plan")
  ) {
    const [tenantId, saasId] = params;
    return store.campamentoProvisioning
      .filter((row) => row.tenant_id === tenantId && row.saas_id === saasId)
      .slice(0, 1)
      .map((row) => ({ status: row.status }));
  }

  if (hasSql(normalized, "select status, plan, last_error", "from campamento_provisioning", "where tenant_id = ? and saas_id = ?")) {
    const [tenantId, saasId] = params;
    return store.campamentoProvisioning
      .filter((row) => row.tenant_id === tenantId && row.saas_id === saasId)
      .slice(0, 1)
      .map((row) => ({
        status: row.status,
        plan: row.plan,
        last_error: row.last_error,
      }));
  }

  if (hasSql(normalized, "select id", "from saas_branding_settings", "where tenant_id = ? and saas_id = ?")) {
    const [tenantId, saasId] = params;
    return store.saasBrandingSettings
      .filter((row) => row.tenant_id === tenantId && row.saas_id === saasId)
      .slice(0, 1)
      .map((row) => ({ id: row.id }));
  }

  if (hasSql(normalized, "select feature_key, status", "from saas_features", "where tenant_id = ? and saas_id = ? and status = 'enabled'")) {
    const [tenantId, saasId] = params;
    return store.saasFeatures
      .filter((row) => row.tenant_id === tenantId && row.saas_id === saasId && lower(row.status) === "enabled")
      .sort((a, b) => a.feature_key.localeCompare(b.feature_key))
      .map((row) => ({ feature_key: row.feature_key, status: row.status }));
  }

  if (hasSql(normalized, "select id, tenant_id, saas_id, feature_key, label, category, status, source, phase_order, metadata, created_at, updated_at", "from saas_features")) {
    const [tenantId, saasId] = params;
    return store.saasFeatures
      .filter((row) => row.tenant_id === tenantId && row.saas_id === saasId)
      .sort((left, right) => (left.phase_order - right.phase_order) || left.label.localeCompare(right.label))
      .map((row) => ({ ...row }));
  }

  if (hasSql(normalized, "from saas_social_accounts")) {
    if (hasSql(normalized, "where id = ? limit 1")) {
      const [id] = params;
      return store.socialAccounts.filter((row) => row.id === id).slice(0, 1).map((row) => ({ ...row }));
    }
    const [tenantId, saasId] = params;
    return store.socialAccounts
      .filter((row) => row.tenant_id === tenantId && row.saas_id === saasId)
      .sort((left, right) => (left.created_at < right.created_at ? 1 : -1))
      .map((row) => ({ ...row }));
  }

  if (hasSql(normalized, "from saas_social_campaigns")) {
    if (hasSql(normalized, "where id = ? limit 1")) {
      const [id] = params;
      return store.socialCampaigns.filter((row) => row.id === id).slice(0, 1).map((row) => ({ ...row }));
    }
    const [tenantId, saasId] = params;
    return store.socialCampaigns
      .filter((row) => row.tenant_id === tenantId && row.saas_id === saasId)
      .sort((left, right) => (left.created_at < right.created_at ? 1 : -1))
      .map((row) => ({ ...row }));
  }

  if (hasSql(normalized, "from saas_social_posts")) {
    if (hasSql(normalized, "where id = ? limit 1")) {
      const [id] = params;
      return store.socialPosts.filter((row) => row.id === id).slice(0, 1).map((row) => ({ ...row }));
    }
    if (hasSql(normalized, "where tenant_id = ? and id = ? limit 1")) {
      const [tenantId, id] = params;
      return store.socialPosts
        .filter((row) => row.tenant_id === tenantId && row.id === id)
        .slice(0, 1)
        .map((row) => ({ ...row }));
    }
    const [tenantId, saasId] = params;
    let nextParamIndex = 2;
    const campaignId = normalized.includes("campaign_id = ?") ? params[nextParamIndex++] : undefined;
    const status = normalized.includes("status = ?") ? params[nextParamIndex++] : undefined;
    const provider = normalized.includes("provider = ?") ? params[nextParamIndex++] : undefined;
    return store.socialPosts
      .filter((row) => row.tenant_id === tenantId && row.saas_id === saasId)
      .filter((row) => (!normalized.includes("campaign_id = ?") || row.campaign_id === campaignId))
      .filter((row) => (!normalized.includes("status = ?") || row.status === status))
      .filter((row) => (!normalized.includes("provider = ?") || row.provider === provider))
      .sort((left, right) => (left.created_at < right.created_at ? 1 : -1))
      .map((row) => ({ ...row }));
  }

  if (hasSql(normalized, "from saas_social_metrics")) {
    if (hasSql(normalized, "where tenant_id = ? and post_id = ?")) {
      const [tenantId, postId] = params;
      return store.socialMetrics
        .filter((row) => row.tenant_id === tenantId && row.post_id === postId)
        .sort((left, right) => (left.captured_at < right.captured_at ? 1 : -1))
        .map((row) => ({ ...row }));
    }
    if (hasSql(normalized, "where tenant_id = ? and saas_id = ?")) {
      const [tenantId, saasId, capturedAfter] = params;
      const threshold = typeof capturedAfter === "string" ? new Date(capturedAfter).getTime() : Number.NEGATIVE_INFINITY;
      return store.socialMetrics
        .filter((row) => row.tenant_id === tenantId && row.saas_id === saasId)
        .filter((row) => new Date(row.captured_at).getTime() >= threshold)
        .map((row) => ({ ...row }));
    }
  }

  if (hasSql(normalized, "from saas_tasks")) {
    if (hasSql(normalized, "where tenant_id = ? and id = ? limit 1")) {
      const [tenantId, taskId] = params;
      return store.tasks
        .filter((row) => row.tenant_id === tenantId && row.id === taskId)
        .slice(0, 1)
        .map((row) => ({ ...row }));
    }
    const [tenantId, saasId] = params;
    return store.tasks
      .filter((row) => row.tenant_id === tenantId && row.saas_id === saasId)
      .filter((row) => (!normalized.includes("status = ?") || row.status === params[2] || row.status === params[3]))
      .filter((row) => (!normalized.includes("category = ?") || row.category === params[3] || row.category === params[2] || row.category === params[4]))
      .filter((row) => (!normalized.includes("assignee_employee_id = ?") || row.assignee_employee_id === params[4] || row.assignee_employee_id === params[3] || row.assignee_employee_id === params[2]))
      .sort((left, right) => (left.updated_at < right.updated_at ? 1 : -1))
      .map((row) => ({ ...row }));
  }

  if (hasSql(normalized, "from saas_task_events")) {
    const [tenantId, taskId] = params;
    return store.taskEvents
      .filter((row) => row.tenant_id === tenantId && row.task_id === taskId)
      .sort((left, right) => (left.created_at < right.created_at ? 1 : -1))
      .map((row) => ({ ...row }));
  }

  if (hasSql(normalized, "select tenant_id from saas where id = ?")) {
    const [saasId] = params;
    return store.saas
      .filter((row) => row.id === saasId)
      .slice(0, 1)
      .map((row) => ({ tenant_id: row.tenant_id }));
  }

  if (hasSql(normalized, "from saas_domains", "where id = ?")) {
    const [domainId] = params;
    return store.saasDomains
      .filter((row) => row.id === domainId)
      .slice(0, 1)
      .map((row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        saas_id: row.saas_id,
        domain: row.domain,
        is_primary: row.is_primary,
        status: row.status,
        last_checked_at: row.last_checked_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
  }

  if (hasSql(normalized, "from saas_domains", "lower(status) in ('pending', 'provisioning')")) {
    const [tenantId, limit] = params;
    return store.saasDomains
      .filter((row) => row.tenant_id === tenantId && ["pending", "provisioning"].includes(lower(row.status)))
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
      .slice(0, Number(limit))
      .map((row) => ({
        id: row.id,
        hostname: row.domain,
        status: row.status,
        saas_id: row.saas_id,
        updated_at: row.updated_at,
      }));
  }

  if (hasSql(normalized, "from provisioning_jobs j", "left join saas_domains d")) {
    const [tenantId, limit] = params;
    return store.provisioningJobs
      .filter((row) => row.tenant_id === tenantId && row.type === "SAAS_PROVISIONING" && row.current_state === "DEGRADED")
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
      .slice(0, Number(limit))
      .map((row) => {
        const domain = store.saasDomains.find((item) => item.tenant_id === row.tenant_id && item.saas_id === row.entity_id);
        return {
          job_id: row.job_id,
          saas_id: row.entity_id,
          current_state: row.current_state,
          updated_at: row.updated_at,
          last_error: row.last_error,
          hostname: domain?.domain ?? null,
          domain_status: domain?.status ?? null,
        };
      });
  }

  return [];
}

function executeRun(store: ProvisioningHarnessStore, sql: string, params: unknown[]): boolean {
  const normalized = normalizeSql(sql);

  if (normalized.startsWith("insert into provisioning_jobs")) {
    const [jobId, type, entityId, correlationId, idempotencyKey, currentState, payloadJson, tenantId, createdAt, updatedAt, executionLock] = params;
    const duplicate = store.provisioningJobs.some(
      (row) => row.job_id === jobId || row.idempotency_key === idempotencyKey || row.correlation_id === correlationId,
    );
    if (duplicate) {
      throw new Error("UNIQUE constraint failed");
    }
    store.provisioningJobs.push({
      job_id: String(jobId),
      type: String(type),
      entity_id: String(entityId),
      correlation_id: String(correlationId),
      idempotency_key: String(idempotencyKey),
      current_state: String(currentState),
      payload_json: String(payloadJson),
      tenant_id: String(tenantId),
      created_at: String(createdAt),
      updated_at: String(updatedAt),
      execution_lock: Number(executionLock),
      lock_acquired_at: null,
      lock_owner: null,
      lock_version: 0,
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      step_history_json: "[]",
      rollback_history_json: "[]",
    });
    return true;
  }

  if (normalized.startsWith("delete from provisioning_jobs where job_id = ?")) {
    const [jobId, currentState] = params;
    const index = store.provisioningJobs.findIndex((row) => row.job_id === jobId && row.current_state === currentState);
    if (index >= 0) {
      store.provisioningJobs.splice(index, 1);
    }
    return true;
  }

  if (normalized.includes("update provisioning_jobs set execution_lock = 1")) {
    const [ownerId, jobId] = params;
    const row = store.provisioningJobs.find((item) => item.job_id === jobId);
    if (row && row.execution_lock === 0 && !["ACTIVE", "SUCCESS", "FAILED"].includes(row.current_state)) {
      row.execution_lock = 1;
      row.current_state = row.current_state === "CREATED" ? "RUNNING" : row.current_state;
      row.lock_acquired_at = nowIso();
      row.updated_at = nowIso();
      row.lock_owner = String(ownerId);
      row.lock_version += 1;
    }
    return true;
  }

  if (hasSql(normalized, "update provisioning_jobs set payload_json = ?")) {
    const [payloadJson, jobId, lockVersion, ownerId] = params;
    const row = store.provisioningJobs.find(
      (item) =>
        item.job_id === jobId &&
        item.lock_version === Number(lockVersion) &&
        item.lock_owner === ownerId &&
        item.execution_lock === 1,
    );
    if (!row) return false;
    row.payload_json = String(payloadJson);
    return true;
  }

  if (hasSql(
    normalized,
    "update provisioning_jobs set current_state = ?",
    "step_history_json = json_insert",
    "where job_id = ?",
    "and current_state = ?",
    "and lock_version = ?",
    "and lock_owner = ?",
    "and execution_lock = 1",
  )) {
    const [toState, historyEntryJson, jobId, fromState, lockVersion, ownerId] = params;
    const row = store.provisioningJobs.find(
      (item) =>
        item.job_id === jobId &&
        item.current_state === fromState &&
        item.lock_version === Number(lockVersion) &&
        item.lock_owner === ownerId &&
        item.execution_lock === 1,
    );
    if (!row) return false;
    row.step_history_json = appendJsonHistory(row.step_history_json, historyEntryJson);
    row.current_state = String(toState);
    row.updated_at = nowIso();
    return true;
  }

  if (hasSql(normalized, "set current_state = 'failed'")) {
    const [error, historyEntryJson, jobId, maybeLockVersion, maybeOwnerId] = params;
    const row = store.provisioningJobs.find((item) => {
      if (item.job_id !== jobId) return false;
      if (typeof maybeLockVersion === "undefined") return true;
      return item.lock_version === Number(maybeLockVersion) && item.lock_owner === maybeOwnerId;
    });
    if (!row) return false;
    row.step_history_json = appendJsonHistory(row.step_history_json, historyEntryJson);
    row.current_state = "FAILED";
    row.last_error = String(error);
    row.execution_lock = 0;
    row.lock_acquired_at = null;
    row.lock_owner = null;
    row.updated_at = nowIso();
    return true;
  }

  if (hasSql(normalized, "set current_state = 'success'")) {
    const [historyEntryJson, jobId, fromState, lockVersion, ownerId] = params;
    const row = store.provisioningJobs.find(
      (item) =>
        item.job_id === jobId &&
        item.current_state === fromState &&
        item.lock_version === Number(lockVersion) &&
        item.lock_owner === ownerId,
    );
    if (!row) return false;
    row.step_history_json = appendJsonHistory(row.step_history_json, historyEntryJson);
    row.current_state = "SUCCESS";
    row.execution_lock = 0;
    row.lock_acquired_at = null;
    row.lock_owner = null;
    row.updated_at = nowIso();
    return true;
  }

  if (hasSql(normalized, "set current_state = 'degraded'")) {
    const [historyEntryJson, jobId, fromState, lockVersion, ownerId] = params;
    const row = store.provisioningJobs.find(
      (item) =>
        item.job_id === jobId &&
        item.current_state === fromState &&
        item.lock_version === Number(lockVersion) &&
        item.lock_owner === ownerId,
    );
    if (!row) return false;
    row.step_history_json = appendJsonHistory(row.step_history_json, historyEntryJson);
    row.current_state = "DEGRADED";
    row.execution_lock = 0;
    row.lock_acquired_at = null;
    row.lock_owner = null;
    row.updated_at = nowIso();
    return true;
  }

  if (hasSql(normalized, "update provisioning_jobs", "set rollback_history_json = json_insert")) {
    const [entryJson, jobId] = params;
    const row = store.provisioningJobs.find((item) => item.job_id === jobId);
    if (!row) return false;
    row.rollback_history_json = appendJsonHistory(row.rollback_history_json, entryJson);
    return true;
  }

  if (normalized.startsWith("insert into saas (")) {
    const [id, name, slug, tenantId] = params;
    const existing = store.saas.find((row) => row.slug === slug);
    if (existing) {
      existing.name = String(name);
      existing.tenant_id = String(tenantId);
      return true;
    }
    store.saas.push({
      id: String(id),
      name: String(name),
      slug: String(slug),
      status: "inactive",
      domain: null,
      subdomain: null,
      public_domain: null,
      public_subdomain: null,
      domain_status: null,
      tenant_id: String(tenantId),
      created_at: nowIso(),
    });
    return true;
  }

  if (normalized.startsWith("insert into saas_instances")) {
    const [id, tenantId, slug, name] = params;
    const existing = store.saasInstances.find((row) => row.slug === slug);
    if (existing) return true;
    store.saasInstances.push({
      id: String(id),
      tenant_id: String(tenantId),
      slug: String(slug),
      name: String(name),
      status: "inactive",
      trial_domain: null,
      custom_domain: null,
      domain_status: null,
      plan_tier: "trial",
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    return true;
  }

  if (normalized.startsWith("update saas set status = 'provisioning'")) {
    const [domain, subdomain, publicDomain, publicSubdomain, saasId, tenantId] = params;
    const row = store.saas.find((item) => item.id === saasId && item.tenant_id === tenantId);
    if (!row) return false;
    row.status = "provisioning";
    row.domain = String(domain);
    row.subdomain = String(subdomain);
    row.public_domain = String(publicDomain);
    row.public_subdomain = String(publicSubdomain);
    row.domain_status = "pending";
    return true;
  }

  if (normalized.startsWith("update saas set status = ?")) {
    const [status, domain, publicDomain, domainStatus, saasId, tenantId] = params;
    const row = store.saas.find((item) => item.id === saasId && item.tenant_id === tenantId);
    if (!row) return false;
    row.status = String(status);
    row.domain = String(domain);
    row.public_domain = String(publicDomain);
    row.domain_status = String(domainStatus);
    return true;
  }

  if (normalized.startsWith("update saas_instances set status = 'provisioning'")) {
    const [trialDomain, customDomain, updatedAt, saasId, tenantId] = params;
    const row = store.saasInstances.find((item) => item.id === saasId && item.tenant_id === tenantId);
    if (!row) return false;
    row.status = "provisioning";
    row.trial_domain = String(trialDomain);
    row.custom_domain = customDomain ? String(customDomain) : null;
    row.domain_status = "pending";
    row.updated_at = String(updatedAt);
    return true;
  }

  if (normalized.startsWith("update saas_instances set status = ?")) {
    const [status, trialDomain, customDomain, domainStatus, updatedAt, saasId, tenantId] = params;
    const row = store.saasInstances.find((item) => item.id === saasId && item.tenant_id === tenantId);
    if (!row) return false;
    row.status = String(status);
    row.trial_domain = String(trialDomain);
    row.custom_domain = customDomain ? String(customDomain) : null;
    row.domain_status = String(domainStatus);
    row.updated_at = String(updatedAt);
    return true;
  }

  if (normalized.startsWith("delete from saas_instances where id = ?")) {
    const [saasId] = params;
    store.saasInstances = store.saasInstances.filter((row) => row.id !== saasId);
    return true;
  }

  if (normalized.startsWith("delete from saas where id = ?")) {
    const [saasId] = params;
    store.saas = store.saas.filter((row) => row.id !== saasId);
    return true;
  }

  if (normalized.startsWith("insert into campamento_provisioning")) {
    const [id, tenantId, saasId, mode, status, plan, lastError, correlationId, createdAt, updatedAt] = params;
    const existing = store.campamentoProvisioning.find((row) => row.tenant_id === tenantId && row.saas_id === saasId);
    if (existing) {
      existing.mode = String(mode);
      existing.status = String(status);
      existing.plan = String(plan);
      existing.last_error = lastError ? String(lastError) : null;
      existing.correlation_id = String(correlationId);
      existing.updated_at = String(updatedAt);
      return true;
    }
    store.campamentoProvisioning.push({
      id: String(id),
      tenant_id: String(tenantId),
      saas_id: String(saasId),
      mode: String(mode),
      status: String(status),
      plan: String(plan),
      last_error: lastError ? String(lastError) : null,
      correlation_id: String(correlationId),
      created_at: String(createdAt),
      updated_at: String(updatedAt),
    });
    return true;
  }

  if (normalized.startsWith("delete from campamento_provisioning where tenant_id = ? and saas_id = ?")) {
    const [tenantId, saasId] = params;
    store.campamentoProvisioning = store.campamentoProvisioning.filter(
      (row) => !(row.tenant_id === tenantId && row.saas_id === saasId),
    );
    return true;
  }

  if (normalized.startsWith("insert into saas_branding_settings")) {
    const id = params[0];
    const tenantId = params[1];
    const saasId = params[2];
    const metadata = params[16];
    const existing = store.saasBrandingSettings.find((row) => row.tenant_id === tenantId && row.saas_id === saasId);
    if (existing) {
      existing.metadata = metadata ? String(metadata) : null;
      return true;
    }
    store.saasBrandingSettings.push({
      id: String(id),
      tenant_id: String(tenantId),
      saas_id: String(saasId),
      metadata: metadata ? String(metadata) : null,
    });
    return true;
  }

  if (normalized.startsWith("delete from saas_branding_settings where tenant_id = ? and saas_id = ?")) {
    const [tenantId, saasId] = params;
    store.saasBrandingSettings = store.saasBrandingSettings.filter(
      (row) => !(row.tenant_id === tenantId && row.saas_id === saasId),
    );
    return true;
  }

  if (normalized.startsWith("insert into saas_features")) {
    const [id, tenantId, saasId, featureKey, label, category, status, source, phaseOrder, metadata, createdAt, updatedAt] = params;
    const existing = store.saasFeatures.find(
      (row) => row.tenant_id === tenantId && row.saas_id === saasId && row.feature_key === featureKey,
    );
    if (existing) {
      existing.label = String(label);
      existing.category = String(category);
      existing.status = String(status);
      existing.source = String(source);
      existing.phase_order = Number(phaseOrder);
      existing.metadata = metadata ? String(metadata) : null;
      existing.updated_at = String(updatedAt);
      return true;
    }
    store.saasFeatures.push({
      id: String(id),
      tenant_id: String(tenantId),
      saas_id: String(saasId),
      feature_key: String(featureKey),
      label: String(label),
      category: String(category),
      status: String(status),
      source: String(source),
      phase_order: Number(phaseOrder),
      metadata: metadata ? String(metadata) : null,
      created_at: String(createdAt),
      updated_at: String(updatedAt),
    });
    return true;
  }

  if (normalized.startsWith("insert into saas_social_accounts")) {
    const [id, tenantId, saasId, provider, handle, displayName, status, authMeta, primary, createdAt, updatedAt] = params;
    const existing = store.socialAccounts.findIndex((row) => row.id === id);
    const next = {
      id: String(id),
      tenant_id: String(tenantId),
      saas_id: String(saasId),
      provider: String(provider),
      handle: handle ? String(handle) : null,
      display_name: displayName ? String(displayName) : null,
      status: String(status),
      auth_meta: authMeta ? String(authMeta) : null,
      primary: Number(primary),
      created_at: String(createdAt),
      updated_at: String(updatedAt),
    };
    if (existing >= 0) {
      store.socialAccounts[existing] = next;
    } else {
      store.socialAccounts.push(next);
    }
    return true;
  }

  if (normalized.startsWith("insert into saas_social_campaigns")) {
    const [id, tenantId, saasId, name, objective, status, targetSegment, startDate, endDate, budgetEstimate, notes, createdAt, updatedAt] = params;
    const existing = store.socialCampaigns.findIndex((row) => row.id === id);
    const next = {
      id: String(id),
      tenant_id: String(tenantId),
      saas_id: String(saasId),
      name: String(name),
      objective: String(objective),
      status: String(status),
      target_segment: String(targetSegment),
      start_date: startDate ? String(startDate) : null,
      end_date: endDate ? String(endDate) : null,
      budget_estimate: typeof budgetEstimate === "number" ? budgetEstimate : (budgetEstimate == null ? null : Number(budgetEstimate)),
      notes: notes ? String(notes) : null,
      created_at: String(createdAt),
      updated_at: String(updatedAt),
    };
    if (existing >= 0) {
      store.socialCampaigns[existing] = next;
    } else {
      store.socialCampaigns.push(next);
    }
    return true;
  }

  if (normalized.startsWith("insert into saas_social_posts")) {
    const [id, tenantId, saasId, campaignId, provider, contentType, title, body, imageHint, status, scheduledAt, postedAt, externalPostId, metadata, createdAt, updatedAt] = params;
    const existing = store.socialPosts.findIndex((row) => row.id === id);
    const next = {
      id: String(id),
      tenant_id: String(tenantId),
      saas_id: String(saasId),
      campaign_id: campaignId ? String(campaignId) : null,
      provider: String(provider),
      content_type: String(contentType),
      title: String(title),
      body: String(body),
      image_hint: imageHint ? String(imageHint) : null,
      status: String(status),
      scheduled_at: scheduledAt ? String(scheduledAt) : null,
      posted_at: postedAt ? String(postedAt) : null,
      external_post_id: externalPostId ? String(externalPostId) : null,
      metadata: metadata ? String(metadata) : null,
      created_at: String(createdAt),
      updated_at: String(updatedAt),
    };
    if (existing >= 0) {
      store.socialPosts[existing] = next;
    } else {
      store.socialPosts.push(next);
    }
    return true;
  }

  if (normalized.startsWith("insert into saas_social_metrics")) {
    const [id, tenantId, saasId, postId, provider, impressions, likes, comments, shares, clicks, leadsGenerated, capturedAt, metadata] = params;
    const existing = store.socialMetrics.findIndex((row) => row.id === id);
    const next = {
      id: String(id),
      tenant_id: String(tenantId),
      saas_id: String(saasId),
      post_id: String(postId),
      provider: String(provider),
      impressions: Number(impressions),
      likes: Number(likes),
      comments: Number(comments),
      shares: Number(shares),
      clicks: Number(clicks),
      leads_generated: Number(leadsGenerated),
      captured_at: String(capturedAt),
      metadata: metadata ? String(metadata) : null,
    };
    if (existing >= 0) {
      store.socialMetrics[existing] = next;
    } else {
      store.socialMetrics.push(next);
    }
    return true;
  }

  if (normalized.startsWith("insert into saas_tasks")) {
    const [id, tenantId, saasId, title, description, category, source, status, severity, assigneeEmployeeId, dueDate, metadata, createdAt, updatedAt] = params;
    store.tasks.push({
      id: String(id),
      tenant_id: String(tenantId),
      saas_id: String(saasId),
      title: String(title),
      description: description ? String(description) : null,
      category: String(category),
      source: String(source),
      status: String(status),
      severity: String(severity),
      assignee_employee_id: assigneeEmployeeId ? String(assigneeEmployeeId) : null,
      due_date: dueDate ? String(dueDate) : null,
      metadata: metadata ? String(metadata) : null,
      created_at: String(createdAt),
      updated_at: String(updatedAt),
    });
    return true;
  }

  if (normalized.startsWith("insert into saas_task_events")) {
    const [id, tenantId, saasId, taskId, type, payload, createdAt] = params;
    store.taskEvents.push({
      id: String(id),
      tenant_id: String(tenantId),
      saas_id: String(saasId),
      task_id: String(taskId),
      type: String(type),
      payload: payload ? String(payload) : null,
      created_at: String(createdAt),
    });
    return true;
  }

  if (normalized.startsWith("delete from saas_features where tenant_id = ? and saas_id = ?")) {
    const [tenantId, saasId] = params;
    store.saasFeatures = store.saasFeatures.filter(
      (row) => !(row.tenant_id === tenantId && row.saas_id === saasId),
    );
    return true;
  }

  if (normalized.startsWith("delete from saas_domains where tenant_id = ? and saas_id = ?")) {
    const [tenantId, saasId] = params;
    store.saasDomains = store.saasDomains.filter(
      (row) => !(row.tenant_id === tenantId && row.saas_id === saasId),
    );
    return true;
  }

  if (normalized.startsWith("update saas_domains set is_primary = 0")) {
    const [updatedAt, tenantId, saasId] = params;
    for (const row of store.saasDomains) {
      if (row.tenant_id === tenantId && row.saas_id === saasId) {
        row.is_primary = 0;
        row.updated_at = String(updatedAt);
      }
    }
    return true;
  }

  if (normalized.startsWith("insert into saas_domains")) {
    const [id, tenantId, saasId, domain, isPrimary, status, lastCheckedAt, createdAt, updatedAt] = params;
    const existing = store.saasDomains.find((row) => row.id === id);
    if (existing) {
      existing.domain = String(domain);
      existing.is_primary = Number(isPrimary);
      existing.status = String(status);
      existing.last_checked_at = (lastCheckedAt as string | null) ?? null;
      existing.updated_at = String(updatedAt);
      return true;
    }
    store.saasDomains.push({
      id: String(id),
      tenant_id: String(tenantId),
      saas_id: String(saasId),
      domain: String(domain),
      is_primary: Number(isPrimary),
      status: String(status),
      last_checked_at: (lastCheckedAt as string | null) ?? null,
      created_at: String(createdAt),
      updated_at: String(updatedAt),
    });
    return true;
  }

  if (normalized.startsWith("insert into campamento_events")) {
    const [id, tenantId, saasId, type, severity, source, message, metadata, correlationId, createdAt] = params;
    store.campamentoEvents.push({
      id: String(id),
      tenant_id: String(tenantId),
      saas_id: saasId ? String(saasId) : null,
      type: String(type),
      severity: String(severity),
      source: String(source),
      message: String(message),
      metadata: metadata ? String(metadata) : null,
      correlation_id: String(correlationId),
      created_at: String(createdAt),
    });
    return true;
  }

  return true;
}

export function createProvisioningHarnessStore(input?: {
  tenantId?: string;
  tenantPlan?: string;
  saasSlug?: string;
  workspaces?: number;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
}): ProvisioningHarnessStore {
  const tenantId = input?.tenantId ?? "tenant_owner";
  const saasSlug = input?.saasSlug ?? "drako";
  const now = nowIso();

  return {
    owners: [{ id: "owner_1", tenant_id: tenantId }],
    tenants: [{ id: tenantId, saas_slug: saasSlug, plan: input?.tenantPlan ?? "pro" }],
    saasSubscriptions: [
      {
        id: `${tenantId}:${saasSlug}`,
        tenant_id: tenantId,
        saas_slug: saasSlug,
        stripe_customer_id: "cus_test",
        stripe_subscription_id: "sub_test",
        stripe_price_id: "price_test",
        plan_code: input?.subscriptionPlan ?? "pro",
        status: input?.subscriptionStatus ?? "active",
        current_period_end: now,
        cancel_at_period_end: 0,
        updated_at: now,
      },
    ],
    saasUsageQuotas: [
      {
        tenant_id: tenantId,
        saas_slug: saasSlug,
        quota_key: "workspaces",
        limit_value: input?.workspaces ?? 5,
      },
    ],
    provisioningJobs: [],
    saas: [],
    saasInstances: [],
    saasDomains: [],
    campamentoProvisioning: [],
    saasBrandingSettings: [],
    saasFeatures: [],
    socialAccounts: [],
    socialCampaigns: [],
    socialPosts: [],
    socialMetrics: [],
    tasks: [],
    taskEvents: [],
    campamentoEvents: [],
    sentQueueMessages: [],
  };
}

export function installProvisioningDbMock(
  mockDb: {
    prepare: { mockImplementation: (fn: (sql: string) => unknown) => void };
  },
  store: ProvisioningHarnessStore,
): void {
  mockDb.prepare.mockImplementation((sql: string) => {
    const statement = {
      bind: (...params: unknown[]) => ({
        all: async () => ({ results: selectRows(store, sql, params) }),
        first: async () => selectRows(store, sql, params)[0] ?? null,
        run: async () => ({ success: executeRun(store, sql, params) }),
      }),
      all: async () => ({ results: selectRows(store, sql, []) }),
      first: async () => selectRows(store, sql, [])[0] ?? null,
      run: async () => ({ success: executeRun(store, sql, []) }),
    };
    return statement;
  });
}

export function createFactoryRuntimeEnv(params: {
  db: unknown;
  store: ProvisioningHarnessStore;
  overrides?: Partial<CreateSaasQueueEnv>;
}): CreateSaasQueueEnv {
  return {
    DRACO_DB: params.db,
    PROVISIONING_QUEUE: {
      send: async (message: QueueMessage) => {
        params.store.sentQueueMessages.push(message);
      },
    },
    DRAKO_BASE_DOMAIN: "drako.systems",
    CLOUDFLARE_API_TOKEN: "token",
    CLOUDFLARE_ZONE_ID: "zone_1",
    PROVISION_DOMAIN_VERIFY_RETRIES: "0",
    PROVISION_DOMAIN_VERIFY_BACKOFF_MS: "0",
    PROVISION_DOMAIN_VERIFY_MAX_BACKOFF_MS: "0",
    PROVISION_DOMAIN_VERIFY_JITTER_MS: "0",
    PROVISION_DOMAIN_VERIFY_TIMEOUT_MS: "1",
    ...(params.overrides ?? {}),
  };
}

export function buildCreateSaasRequest(params: {
  slug: string;
  name?: string;
  idempotencyKey?: string;
  correlationId?: string;
  customDomainRequested?: string;
  blueprintDraft?: Record<string, unknown>;
}): Request {
  const blueprintDraft = params.blueprintDraft
    ? {
      ...params.blueprintDraft,
      provisioning: {
        ...((params.blueprintDraft.provisioning as Record<string, unknown> | undefined) ?? {}),
        domains: {
          ...((((params.blueprintDraft.provisioning as { domains?: Record<string, unknown> } | undefined)?.domains) ?? {})),
          ...(params.customDomainRequested ? { customDomainRequested: params.customDomainRequested } : {}),
        },
      },
    }
    : (
      params.customDomainRequested
        ? {
          provisioning: {
            domains: {
              customDomainRequested: params.customDomainRequested,
            },
            stripe: {
              billingInterval: "MONTHLY",
              taxProfile: "ES_AUTONOMO",
              currency: "EUR",
            },
            ai: {
              tier: "BALANCED",
              preferredProviders: [],
            },
          },
        }
        : undefined
    );

  return new Request("https://drako.systems/api/owner/saas-factory/create-saas", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-correlation-id": params.correlationId ?? `corr_${params.slug}`,
    },
    body: JSON.stringify({
      name: params.name ?? `Factory ${params.slug}`,
      slug: params.slug,
      idempotencyKey: params.idempotencyKey ?? `idem_${params.slug}_0001`,
      plans: [{ planCode: "pro", monthlyPriceCents: 2900 }],
      blueprintDraft,
    }),
  });
}

export function findProvisioningJob(store: ProvisioningHarnessStore, jobId: string) {
  return store.provisioningJobs.find((job) => job.job_id === jobId);
}

export function findPrimaryDomainRow(store: ProvisioningHarnessStore, saasId: string) {
  return store.saasDomains.find((row) => row.saas_id === saasId && row.is_primary === 1);
}

export function findCustomDomainRow(store: ProvisioningHarnessStore, saasId: string, domain: string) {
  return store.saasDomains.find((row) => row.saas_id === saasId && row.is_primary === 0 && lower(row.domain) === lower(domain));
}

export async function processQueuedFactoryJob(
  store: ProvisioningHarnessStore,
  env: CreateSaasQueueEnv,
  jobId: string,
) {
  const message = store.sentQueueMessages.find((candidate) => candidate.jobId === jobId);
  expect(message).toBeTruthy();

  const ack = vi.fn();
  const retry = vi.fn();
  const batch = {
    messages: [
      {
        id: `msg_${message.jobId}`,
        body: message,
        ack,
        retry,
      },
    ],
  } as const;

  await processQueueBatch(batch as any, env as any);

  expect(retry).not.toHaveBeenCalled();
  expect(ack).toHaveBeenCalledTimes(1);
}

export function createCloudflareFetch(params: {
  verifyStatuses: string[];
  createStatus?: string;
  failCreateMessage?: string;
  hostnameStatuses?: Record<string, string[]>;
}): typeof fetch {
  const bindings = new Map<
    string,
    {
      bindingId: string;
      hostname: string;
      createStatus: string;
      verifyStatuses: string[];
      lastStatus: string;
      deleted: boolean;
    }
  >();

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "GET" && url.pathname.endsWith("/custom_hostnames") && url.searchParams.has("hostname")) {
      const hostname = lower(url.searchParams.get("hostname"));
      const binding = bindings.get(hostname);
      const result = binding && !binding.deleted
        ? [{ id: binding.bindingId, hostname: binding.hostname, status: binding.lastStatus }]
        : [];
      return new Response(JSON.stringify({ success: true, result }), { status: 200 });
    }

    if (method === "POST" && url.pathname.endsWith("/custom_hostnames")) {
      if (params.failCreateMessage) {
        throw new Error(params.failCreateMessage);
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { hostname?: string };
      const hostname = lower(body.hostname);
      const hostnameVerifyStatuses = params.hostnameStatuses?.[hostname]
        ? [...params.hostnameStatuses[hostname]!]
        : [...params.verifyStatuses];
      const bindingId = `ch_${bindings.size + 1}`;
      bindings.set(hostname, {
        bindingId,
        hostname,
        createStatus: params.createStatus ?? "pending",
        verifyStatuses: hostnameVerifyStatuses,
        lastStatus: params.createStatus ?? "pending",
        deleted: false,
      });
      return new Response(JSON.stringify({ success: true, result: { id: bindingId, hostname, status: params.createStatus ?? "pending" } }), { status: 200 });
    }

    if (method === "GET" && url.pathname.includes("/custom_hostnames/")) {
      const bindingId = url.pathname.split("/").pop() ?? "";
      const binding = [...bindings.values()].find((item) => item.bindingId === bindingId && !item.deleted);
      if (!binding) {
        return new Response(JSON.stringify({ success: false, errors: [{ message: "not found" }] }), { status: 404 });
      }
      const nextStatus = binding.verifyStatuses.shift() ?? binding.lastStatus;
      binding.lastStatus = nextStatus;
      return new Response(JSON.stringify({ success: true, result: { id: binding.bindingId, hostname: binding.hostname, status: nextStatus } }), { status: 200 });
    }

    if (method === "DELETE" && url.pathname.includes("/custom_hostnames/")) {
      const bindingId = url.pathname.split("/").pop() ?? "";
      const binding = [...bindings.values()].find((item) => item.bindingId === bindingId);
      if (binding) {
        binding.deleted = true;
      }
      return new Response(JSON.stringify({ success: true, result: { id: bindingId } }), { status: 200 });
    }

    return new Response(JSON.stringify({ success: false, errors: [{ message: `Unhandled Cloudflare call ${method} ${url.pathname}` }] }), { status: 500 });
  }) as typeof fetch;
}
