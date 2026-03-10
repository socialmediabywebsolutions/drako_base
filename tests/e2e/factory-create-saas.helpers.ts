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
  tenant_id: string;
  created_at: string;
};

type SaasInstanceRow = {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  status: string;
  plan_tier: string;
  created_at: string;
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

  if (hasSql(normalized, "from saas_domains", "lower(domain) = lower(?)")) {
    const [domain] = params;
    return store.saasDomains
      .filter((row) => lower(row.domain) === lower(domain))
      .slice(0, 1)
      .map((row) => ({ id: row.id }));
  }

  if (hasSql(normalized, "from saas_subscriptions")) {
    const [tenantId, saasSlug] = params;
    return store.saasSubscriptions
      .filter((row) => row.tenant_id === tenantId && row.saas_slug === saasSlug)
      .slice(0, 1);
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
      status: "active",
      plan_tier: "trial",
      created_at: nowIso(),
    });
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
        plan_code: "pro",
        status: "active",
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
        run: async () => ({ success: executeRun(store, sql, params) }),
      }),
      all: async () => ({ results: selectRows(store, sql, []) }),
      run: async () => ({ success: executeRun(store, sql, []) }),
    };
    return statement;
  });
}

export function createFactoryRuntimeEnv(params: {
  db: unknown;
  store: ProvisioningHarnessStore;
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
  };
}

export function buildCreateSaasRequest(params: {
  slug: string;
  idempotencyKey?: string;
  correlationId?: string;
}): Request {
  return new Request("https://drako.systems/api/owner/saas-factory/create-saas", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-correlation-id": params.correlationId ?? `corr_${params.slug}`,
    },
    body: JSON.stringify({
      name: `Factory ${params.slug}`,
      slug: params.slug,
      idempotencyKey: params.idempotencyKey ?? `idem_${params.slug}_0001`,
      plans: [{ planCode: "pro", monthlyPriceCents: 2900 }],
    }),
  });
}

export function findProvisioningJob(store: ProvisioningHarnessStore, jobId: string) {
  return store.provisioningJobs.find((job) => job.job_id === jobId);
}

export function findPrimaryDomainRow(store: ProvisioningHarnessStore, saasId: string) {
  return store.saasDomains.find((row) => row.saas_id === saasId && row.is_primary === 1);
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
      const body = JSON.parse(String(init?.body ?? "{}")) as { hostname?: string };
      const hostname = lower(body.hostname);
      const bindingId = `ch_${bindings.size + 1}`;
      bindings.set(hostname, {
        bindingId,
        hostname,
        createStatus: params.createStatus ?? "pending",
        verifyStatuses: [...params.verifyStatuses],
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
