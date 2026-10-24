import { queryAll } from "@/lib/db";

export type GovernanceSeverity = "INFO" | "WARN" | "ERROR" | "CRITICAL";
export type GovernanceStatus = "HEALTHY" | "WARNING" | "DEGRADED" | "BLOCKED" | "UNKNOWN";

export type GovernanceRow = {
  saasId: string | null;
  saasSlug: string;
  saasName: string | null;
  instanceId: string | null;
  domainId: string | null;
  tenantId: string | null;
  lifecycleStatus: string | null;
  billingStatus: string | null;
  provisioningStatus: string | null;
  domainStatus: string | null;
  auditStatus: string | null;
  readinessState: string | null;
  overallGovernanceStatus: GovernanceStatus;
  severity: GovernanceSeverity;
  lastEventAt: string | null;
  lastAuditAt: string | null;
  lastProvisioningAt: string | null;
  lastBillingAt: string | null;
  blockers: string[];
  warnings: string[];
  signals: string[];
  recommendations: string[];
  topIssue: string | null;
};

export type GovernanceFilters = {
  status?: GovernanceStatus | undefined;
  severity?: GovernanceSeverity | undefined;
  lifecycle?: string | undefined;
  billing?: string | undefined;
  provisioning?: string | undefined;
  domainStatus?: string | undefined;
  saasSlug?: string | undefined;
  search?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  sort?: "priority" | "recent";
  tenantId?: string | undefined;
};

export type GovernanceSummary = {
  total: number;
  healthy: number;
  warnings: number;
  degraded: number;
  blocked: number;
  verifyingDomains: number;
  provisioningRunning: number;
  auditStale: number;
  billingIssues: number;
  lifecycleMismatches: number;
  criticalBlockers: number;
};

type RawGovernanceRow = {
  saas_id: string | null;
  saas_slug: string;
  saas_name: string | null;
  saas_status: string | null;
  instance_id: string | null;
  tenant_id: string | null;
  instance_status: string | null;
  lifecycle_status: string | null;
  billing_status: string | null;
  readiness_state: string | null;
  domain_id: string | null;
  domain_status: string | null;
  provisioning_status: string | null;
  last_job_state: string | null;
  last_job_at: string | null;
  last_billing_severity: string | null;
  last_billing_outcome: string | null;
  last_billing_at: string | null;
  last_audit_at: string | null;
};

const PROVISIONING_STUCK_MS = 1000 * 60 * 60 * 4; // 4h
const AUDIT_STALE_MS = 1000 * 60 * 60 * 24 * 30; // 30d
const BILLING_STALE_MS = 1000 * 60 * 60 * 24 * 14; // 14d

function normalizeLifecycle(status: string | null): string | null {
  if (!status) return null;
  const normalized = status.toLowerCase();
  if (["active", "trial_active", "live"].includes(normalized)) return "active";
  if (["past_due", "past-due"].includes(normalized)) return "past_due";
  if (["paused"].includes(normalized)) return "paused";
  if (["archived", "cancelled", "canceled"].includes(normalized)) return "archived";
  if (["provisioning", "creating"].includes(normalized)) return "provisioning";
  return normalized;
}

function normalizeBilling(status: string | null): string | null {
  if (!status) return null;
  const normalized = status.toLowerCase();
  if (["active", "paid"].includes(normalized)) return "active";
  if (["past_due", "past-due", "unpaid", "incomplete", "incomplete_expired"].includes(normalized)) return "past_due";
  if (["canceled", "cancelled"].includes(normalized)) return "canceled";
  return normalized;
}

function normalizeProvisioning(status: string | null, lastJobState: string | null): string | null {
  const candidate = lastJobState ?? status;
  if (!candidate) return null;
  const normalized = candidate.toUpperCase();
  if (["SUCCESS", "ACTIVE"].includes(normalized)) return "SUCCESS";
  if (["DEGRADED"].includes(normalized)) return "DEGRADED";
  if (["FAILED", "ROLLING_BACK"].includes(normalized)) return "FAILED";
  if (["CREATED", "RUNNING", "SAAS_REGISTERED", "STRIPE_PRODUCT_CREATED", "RUNTIME_DEPLOYED", "PROVISION_WORKER", "CREATE_DOMAIN_BINDING", "VERIFY_DOMAIN", "BOOTSTRAP_READY", "CUSTOM_DOMAIN_READY", "DOMAINS_REGISTERED", "TENANT_CREATED", "SUBSCRIPTION_CREATED", "SUBSCRIPTION_CONFIRMED"].includes(normalized))
    return "RUNNING";
  if (["LOCKED"].includes(normalized)) return "LOCKED";
  return normalized;
}

function normalizeDomainStatus(status: string | null): string | null {
  if (!status) return null;
  const normalized = status.toLowerCase();
  if (["verifying", "pending", "pending_manual", "requested"].includes(normalized)) return "verifying";
  if (["active", "verified"].includes(normalized)) return "active";
  if (["failed", "error"].includes(normalized)) return "failed";
  if (["locked"].includes(normalized)) return "locked";
  return normalized;
}

function resolveSeverity(score: number): GovernanceSeverity {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "ERROR";
  if (score >= 25) return "WARN";
  return "INFO";
}

function resolveOverallStatus(severity: GovernanceSeverity, hasUnknown: boolean): GovernanceStatus {
  if (hasUnknown && severity === "INFO") return "UNKNOWN";
  if (severity === "CRITICAL") return "BLOCKED";
  if (severity === "ERROR") return "DEGRADED";
  if (severity === "WARN") return "WARNING";
  return "HEALTHY";
}

function push(arr: string[], value: string | null | undefined) {
  if (value) arr.push(value);
}

export function deriveGovernanceRow(raw: RawGovernanceRow): GovernanceRow {
  const lifecycle = normalizeLifecycle(raw.lifecycle_status ?? raw.instance_status ?? raw.saas_status);
  const billing = normalizeBilling(raw.billing_status);
  const provisioning = normalizeProvisioning(raw.provisioning_status, raw.last_job_state);
  const domain = normalizeDomainStatus(raw.domain_status);
  const now = Date.now();
  const lastProvisioningAt = raw.last_job_at;
  const lastBillingAt = raw.last_billing_at;
  const lastAuditAt = raw.last_audit_at ?? raw.last_billing_at;
  const signals: string[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];
  const recommendations: string[] = [];

  const hasUnknown = !lifecycle && !billing && !provisioning && !domain;
  let score = 0;

  // Lifecycle integrity
  if (lifecycle === "archived" && billing === "active") {
    score += 60;
    blockers.push("Lifecycle archived but billing still active");
    recommendations.push("Review billing subscription state for archived SaaS");
  }
  if (lifecycle === "active" && billing === "past_due") {
    score += 50;
    warnings.push("Billing past_due while lifecycle active");
    recommendations.push("Check Stripe subscription and enforcement fail-closed status");
  }
  if (lifecycle === "past_due") {
    score += 25;
    warnings.push("Instance in past_due");
  }

  // Provisioning & domain signals
  if (provisioning === "FAILED") {
    score += 80;
    blockers.push("Provisioning job failed");
    recommendations.push("Inspect provisioning job timeline and retry");
  } else if (provisioning === "DEGRADED") {
    score += 60;
    warnings.push("Provisioning degraded");
    recommendations.push("Review degraded job steps and re-run missing steps");
  } else if (provisioning === "RUNNING") {
    const stale = lastProvisioningAt && now - Date.parse(lastProvisioningAt) > PROVISIONING_STUCK_MS;
    if (stale) {
      score += 35;
      warnings.push("Provisioning running for too long");
      recommendations.push("Check job lock or stuck step; consider manual unlock");
    }
  }

  if (domain === "failed" || domain === "locked") {
    score += 75;
    blockers.push("Domain provisioning blocked");
    recommendations.push("Re-run domain verify or fix DNS/SSL binding");
  } else if (domain === "verifying") {
    score += 25;
    warnings.push("Domain awaiting verification");
    recommendations.push("Confirm DNS TXT verification is present");
  }

  // Audit & billing freshness
  if (lastBillingAt && now - Date.parse(lastBillingAt) > BILLING_STALE_MS) {
    score += 20;
    warnings.push("Billing audit stale");
    recommendations.push("Trigger billing audit helper for this SaaS");
  }

  if (!lastAuditAt || now - Date.parse(lastAuditAt) > AUDIT_STALE_MS) {
    score += 25;
    warnings.push("Audit signals missing or stale");
    recommendations.push("Record fresh audit event for lifecycle/billing");
  }

  if (raw.last_billing_severity && raw.last_billing_severity.toLowerCase() === "error") {
    score += 50;
    blockers.push("Recent billing audit error");
    recommendations.push("Resolve last billing audit error outcome: " + (raw.last_billing_outcome ?? "unknown"));
  }

  // Consistency between saas and instance
  if (raw.saas_status && raw.instance_status && raw.saas_status !== raw.instance_status) {
    score += 25;
    warnings.push("Status mismatch between saas and instance");
    recommendations.push("Normalize instance status to match canonical saas status");
  }

  const severity = resolveSeverity(score);
  const overallGovernanceStatus = resolveOverallStatus(severity, hasUnknown);
  const topIssue = blockers[0] ?? warnings[0] ?? null;
  const lastEventAt = [lastProvisioningAt, lastBillingAt, lastAuditAt].filter(Boolean).sort().slice(-1)[0] ?? null;

  push(signals, lifecycle ? `lifecycle:${lifecycle}` : null);
  push(signals, billing ? `billing:${billing}` : null);
  push(signals, provisioning ? `provisioning:${provisioning}` : null);
  push(signals, domain ? `domain:${domain}` : null);

  return {
    saasId: raw.saas_id,
    saasSlug: raw.saas_slug,
    saasName: raw.saas_name,
    instanceId: raw.instance_id,
    domainId: raw.domain_id,
    tenantId: raw.tenant_id,
    lifecycleStatus: lifecycle,
    billingStatus: billing,
    provisioningStatus: provisioning,
    domainStatus: domain,
    auditStatus: raw.last_billing_severity,
    readinessState: raw.readiness_state,
    overallGovernanceStatus,
    severity,
    lastEventAt,
    lastAuditAt,
    lastProvisioningAt,
    lastBillingAt,
    blockers,
    warnings,
    signals,
    recommendations,
    topIssue,
  };
}

function applyFilters(rows: GovernanceRow[], filters: GovernanceFilters): GovernanceRow[] {
  return rows.filter((row) => {
    if (filters.status && row.overallGovernanceStatus !== filters.status) return false;
    if (filters.severity && row.severity !== filters.severity) return false;
    if (filters.lifecycle && row.lifecycleStatus !== filters.lifecycle) return false;
    if (filters.billing && row.billingStatus !== filters.billing) return false;
    if (filters.provisioning && row.provisioningStatus !== filters.provisioning) return false;
    if (filters.domainStatus && row.domainStatus !== filters.domainStatus) return false;
    if (filters.saasSlug && row.saasSlug !== filters.saasSlug) return false;
    if (filters.search) {
      const term = filters.search.toLowerCase();
      const matches =
        row.saasSlug.toLowerCase().includes(term) ||
        (row.saasName ?? "").toLowerCase().includes(term) ||
        (row.domainId ?? "").toLowerCase().includes(term) ||
        (row.signals.join(" ").toLowerCase().includes(term));
      if (!matches) return false;
    }
    return true;
  });
}

function sortRows(rows: GovernanceRow[], sort: GovernanceFilters["sort"]): GovernanceRow[] {
  if (sort === "recent") {
    return [...rows].sort((a, b) => {
      const ta = a.lastEventAt ? Date.parse(a.lastEventAt) : 0;
      const tb = b.lastEventAt ? Date.parse(b.lastEventAt) : 0;
      return tb - ta;
    });
  }
  // priority: severity weight then blockers count then lastEvent
  const severityWeight: Record<GovernanceSeverity, number> = { INFO: 0, WARN: 1, ERROR: 2, CRITICAL: 3 };
  return [...rows].sort((a, b) => {
    const sa = severityWeight[a.severity];
    const sb = severityWeight[b.severity];
    if (sa !== sb) return sb - sa;
    if (a.blockers.length !== b.blockers.length) return b.blockers.length - a.blockers.length;
    const ta = a.lastEventAt ? Date.parse(a.lastEventAt) : 0;
    const tb = b.lastEventAt ? Date.parse(b.lastEventAt) : 0;
    return tb - ta;
  });
}

export function buildSummary(rows: GovernanceRow[]): GovernanceSummary {
  return rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.overallGovernanceStatus === "HEALTHY") acc.healthy += 1;
      if (row.overallGovernanceStatus === "WARNING") acc.warnings += 1;
      if (row.overallGovernanceStatus === "DEGRADED") acc.degraded += 1;
      if (row.overallGovernanceStatus === "BLOCKED") acc.blocked += 1;

      if (row.domainStatus === "verifying") acc.verifyingDomains += 1;
      if (row.provisioningStatus === "RUNNING") acc.provisioningRunning += 1;
      if (row.warnings.includes("Billing audit stale") || row.warnings.includes("Audit signals missing or stale")) acc.auditStale += 1;
      if ((row.billingStatus === "past_due") || row.blockers.some((b) => b.toLowerCase().includes("billing")) || row.warnings.some((w) => w.toLowerCase().includes("billing"))) acc.billingIssues += 1;
      if (row.warnings.includes("Status mismatch between saas and instance")) acc.lifecycleMismatches += 1;
      if (row.severity === "CRITICAL" || row.blockers.length > 0) acc.criticalBlockers += 1;
      return acc;
    },
    {
      total: 0,
      healthy: 0,
      warnings: 0,
      degraded: 0,
      blocked: 0,
      verifyingDomains: 0,
      provisioningRunning: 0,
      auditStale: 0,
      billingIssues: 0,
      lifecycleMismatches: 0,
      criticalBlockers: 0,
    },
  );
}

export async function listOperatorGovernanceView(filters: GovernanceFilters = {}): Promise<{ rows: GovernanceRow[]; summary: GovernanceSummary }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.tenantId) {
    where.push("s.tenant_id = ?");
    params.push(filters.tenantId);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rawRows = await queryAll<RawGovernanceRow>(
    `SELECT
        s.id AS saas_id,
        s.slug AS saas_slug,
        s.name AS saas_name,
        s.status AS saas_status,
        i.id AS instance_id,
        i.tenant_id,
        i.status AS instance_status,
        COALESCE(i.lifecycle_status, i.plan_status, i.status) AS lifecycle_status,
        i.billing_status,
        i.readiness_state,
        d.id AS domain_id,
        d.status AS domain_status,
        cp.status AS provisioning_status,
        (SELECT pj.current_state FROM provisioning_jobs pj WHERE pj.entity_id = s.id ORDER BY pj.updated_at DESC LIMIT 1) AS last_job_state,
        (SELECT pj.updated_at FROM provisioning_jobs pj WHERE pj.entity_id = s.id ORDER BY pj.updated_at DESC LIMIT 1) AS last_job_at,
        (SELECT bal.severity FROM billing_audit_logs bal WHERE bal.saas_slug = s.slug ORDER BY bal.created_at DESC LIMIT 1) AS last_billing_severity,
        (SELECT json_extract(bal.metadata_json, '$.outcome') FROM billing_audit_logs bal WHERE bal.saas_slug = s.slug ORDER BY bal.created_at DESC LIMIT 1) AS last_billing_outcome,
        (SELECT bal.created_at FROM billing_audit_logs bal WHERE bal.saas_slug = s.slug ORDER BY bal.created_at DESC LIMIT 1) AS last_billing_at,
        (SELECT bal.created_at FROM billing_audit_logs bal WHERE bal.saas_slug = s.slug ORDER BY bal.created_at DESC LIMIT 1) AS last_audit_at
     FROM saas s
     LEFT JOIN saas_instances i ON i.id = s.id
     LEFT JOIN saas_domains d ON d.saas_id = s.id AND d.is_primary = 1
     LEFT JOIN campamento_provisioning cp ON cp.saas_id = s.id AND cp.tenant_id = s.tenant_id
     ${whereSql}`,
    ...params,
  );

  const derived = rawRows.map(deriveGovernanceRow);
  const filtered = applyFilters(derived, filters);
  const sorted = sortRows(filtered, filters.sort ?? "priority");
  const offset = Math.max(0, filters.offset ?? 0);
  const limit = filters.limit ?? sorted.length;
  const paginated = sorted.slice(offset, offset + limit);
  return { rows: paginated, summary: buildSummary(sorted) };
}

export async function getOperatorGovernanceBySaas(identifier: { saasId?: string; saasSlug?: string }): Promise<GovernanceRow | null> {
  const filters: GovernanceFilters = identifier.saasId ? { search: identifier.saasId } : { saasSlug: identifier.saasSlug };
  const { rows } = await listOperatorGovernanceView(filters);
  return rows[0] ?? null;
}

export async function getOperatorGovernanceSummary(): Promise<GovernanceSummary> {
  const { summary } = await listOperatorGovernanceView();
  return summary;
}
