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
  const instanceRows = await queryAll<{ slug: string }>(
    "SELECT slug FROM saas_instances WHERE tenant_id = ? AND id = ? LIMIT 1",
    params.tenantId,
    params.saasId,
  );
  if (instanceRows[0]?.slug) return instanceRows[0].slug;

  // Legacy Fallback (saas table) - optional, but safe to keep for now if saas_instances miss something (unlikely)
  const saasRows = await queryAll<SaasRow>(
    "SELECT slug FROM saas WHERE tenant_id = ? AND id = ? LIMIT 1",
    params.tenantId,
    params.saasId,
  );
  return saasRows[0]?.slug;
}

// 1. Resolve normalized host
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

  try {
    // 🏰 PHASE 12: DOMAIN HOST RESOLVING PRIORITY
    // 1. Custom Domain (Strict: must be ACTIVE owner)
    const customRows = await queryAll<{ id: string, tenant_id: string, slug: string, domain_status: string }>(
      "SELECT id, tenant_id, slug, domain_status FROM saas_instances WHERE custom_domain = ? LIMIT 1",
      normalizedHost
    );

    if (customRows.length > 0) {
      const row = customRows[0];
      if (row.domain_status === 'active') {
        return {
          status: "ACTIVE",
          tenantId: row.tenant_id,
          saasId: row.id,
          saasSlug: row.slug,
          reason: "CUSTOM_DOMAIN_MATCH",
          severity: "INFO",
          correlationId,
          normalizedHost,
          wasWww: normalized.wasWww
        };
      } else {
        // Domain matched but NOT active (e.g. pending, failed, or locked).
        // Should we return error or redirect?
        // User requirement: "si Host == custom_domain pero status != active => redirigir al trial_domain o mostrar /client/domains con aviso (NO 500)"
        // We return a status that middleware can handle (e.g. DOMAIN_NOT_ACTIVE)
        return {
          status: "PENDING",
          reason: "DOMAIN_PENDING_ACTIVATION",
          severity: "WARNING",
          saasSlug: row.slug, // Pass slug so we can redirect to trial
          correlationId,
          normalizedHost,
          wasWww: normalized.wasWww
        };
      }
    }

    // 2. Trial Domain (slug.drako.systems)
    // Check if host ends with BASE_DOMAIN
    // For now assuming we extract slug from subdomain
    // e.g. "my-saas.drako.systems" -> slug "my-saas"
    // Or we can query `trial_domain` column if populated accurately.

    const trialRows = await queryAll<{ id: string, tenant_id: string, slug: string, status: string }>(
      "SELECT id, tenant_id, slug, status FROM saas_instances WHERE trial_domain = ? LIMIT 1",
      normalizedHost
    );

    if (trialRows.length > 0) {
      const row = trialRows[0];
      return {
        status: row.status === 'active' || row.status === 'provisioning' ? "ACTIVE" : "PAUSED",
        tenantId: row.tenant_id,
        saasId: row.id,
        saasSlug: row.slug,
        reason: "TRIAL_DOMAIN_MATCH",
        severity: "INFO",
        correlationId,
        normalizedHost,
        wasWww: normalized.wasWww
      };
    }

    // 3. Fallback: Legacy saas_domains (Safe Fallback)
    const rows = await queryAll<DomainRow>(
      `SELECT id, tenant_id, saas_id, domain, status, verification_status, verification_reason, last_checked_at, updated_at
        FROM saas_domains WHERE lower(domain) = ? LIMIT 1`,
      normalizedHost,
    );

    if (rows.length > 0) {
      const row = rows[0];
      const mapped: DomainResolution = mapDomainStatus(row);
      const saasSlug = await resolveSaasSlug({ tenantId: row.tenant_id, saasId: row.saas_id });
      return {
        status: mapped.status,
        tenantId: row.tenant_id,
        saasId: row.saas_id,
        saasSlug,
        reason: mapped.reason,
        severity: mapped.severity ?? (mapped.status === "ACTIVE" ? "INFO" : "WARNING"),
        domainId: row.id,
        correlationId,
        normalizedHost,
        wasWww: normalized.wasWww,
      };
    }

    return {
      status: "NOT_FOUND",
      reason: "DOMAIN_UNREGISTERED",
      severity: "WARNING",
      correlationId,
      normalizedHost,
      wasWww: normalized.wasWww
    };

  } catch (error: any) {
    console.error("HOST_RESOLVER_ERROR", error);
    return {
      status: "NOT_FOUND",
      reason: "RESOLVER_EXCEPTION",
      severity: "ERROR",
      correlationId,
      normalizedHost,
      wasWww: normalized.wasWww,
    };
  }
}
