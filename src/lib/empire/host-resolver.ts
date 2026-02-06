import { queryAll } from "../db";
import { normalizeHostnameInput } from "./domain-utils";
import { mapDomainStatus, type DomainResolution, type HostResolutionStatus } from "./host-status-utils";
import { generateCorrelationId } from "../correlation";

type DomainRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  domain: string;
  status: string;
  verification_status: string | null;
  verification_reason: string | null;
  last_checked_at: string | null;
  updated_at: string | null;
};

type SaasProjectRow = {
  slug: string;
};

type SaasRow = {
  slug: string;
};

export type HostResolution = {
  status: HostResolutionStatus;
  tenantId?: string;
  saasId?: string;
  saasSlug?: string;
  reason?: string;
  severity?: "INFO" | "WARNING" | "ERROR";
  verificationStatus?: string | null;
  verificationReason?: string | null;
  lastCheckedAt?: string | null;
  updatedAt?: string | null;
  domainId?: string;
  correlationId: string;
  normalizedHost: string;
  wasWww: boolean;
  materializationStep?: number; // 0=Init, 1=Form, 2=Dossier, 3=Plan, 4=Active
};


async function resolveSaasSlug(params: { tenantId: string; saasId: string }): Promise<string | undefined> {
  const projectRows = await queryAll<SaasProjectRow>(
    "SELECT slug FROM saas_projects WHERE tenant_id = ? AND id = ? LIMIT 1",
    params.tenantId,
    params.saasId,
  );
  if (projectRows[0]?.slug) return projectRows[0].slug;

  const saasRows = await queryAll<SaasRow>(
    "SELECT slug FROM saas WHERE tenant_id = ? AND id = ? LIMIT 1",
    params.tenantId,
    params.saasId,
  );
  return saasRows[0]?.slug;
}

export async function resolveHostToSaas(hostname: string, providedCorrelationId?: string): Promise<HostResolution> {
  const correlationId = providedCorrelationId ?? generateCorrelationId();
  const normalized = normalizeHostnameInput(hostname);
  const normalizedHost = normalized.hostname ?? "";
  if (!normalized.hostname) {
    return {
      status: "NOT_FOUND",
      reason: normalized.reason ?? "EMPTY_HOST",
      correlationId,
      normalizedHost,
      wasWww: normalized.wasWww,
    };
  }

  // OLIMPO: Handle DB unavailability gracefully
  let rows: DomainRow[];
  try {
    rows = await queryAll<DomainRow>(
      `SELECT id, tenant_id, saas_id, domain, status, verification_status, verification_reason, last_checked_at, updated_at
       FROM saas_domains WHERE lower(domain) = ? LIMIT 1`,
      normalizedHost,
    );
  } catch (error) {
    console.error("HOST_RESOLVER_DB_UNAVAILABLE", error);
    return {
      status: "NOT_FOUND",
      reason: "DATABASE_UNAVAILABLE",
      severity: "ERROR",
      correlationId,
      normalizedHost,
      wasWww: normalized.wasWww,
    };
  }

  const row = rows[0];
  if (!row) {
    return {
      status: "NOT_FOUND",
      reason: "DOMAIN_NOT_FOUND",
      severity: "WARNING",
      correlationId,
      normalizedHost,
      wasWww: normalized.wasWww,
    };
  }

  const mapped: DomainResolution = mapDomainStatus(row);
  const saasSlug = await resolveSaasSlug({ tenantId: row.tenant_id, saasId: row.saas_id });

  // 🦅 DRAKO ORCHESTRATOR: Fetch Materialization Step
  let materializationStep = 0;
  try {
    const tenantRows = await queryAll<{ materialization_step: number }>(
      "SELECT materialization_step FROM tenants WHERE id = ? LIMIT 1",
      row.tenant_id
    );
    materializationStep = tenantRows[0]?.materialization_step ?? 0;
  } catch (err) {
    console.error("FAILED_FETCHING_MATERIALIZATION_STEP", err);
    // Default to 0 (Gatekeeper Active) if DB fails here, safe fallback.
  }

  return {
    status: mapped.status,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    saasSlug,
    reason: mapped.reason,
    severity: mapped.severity ?? (mapped.status === "ACTIVE" ? "INFO" : "WARNING"),
    verificationStatus: row.verification_status,
    verificationReason: row.verification_reason,
    lastCheckedAt: row.last_checked_at,
    updatedAt: row.updated_at,
    domainId: row.id,
    correlationId,
    normalizedHost,
    wasWww: normalized.wasWww,
    materializationStep,
  };
}
