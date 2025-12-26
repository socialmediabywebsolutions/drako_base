import { queryAll } from "@/lib/db";
import { normalizeHostnameInput } from "@/lib/empire/domain-utils";

type DomainRow = {
  tenant_id: string;
  saas_id: string;
  domain: string;
  status: string;
};

type SaasProjectRow = {
  slug: string;
};

type SaasRow = {
  slug: string;
};

export type HostResolutionStatus = "ACTIVE" | "PENDING" | "PAUSED" | "NOT_FOUND";

export type HostResolution = {
  status: HostResolutionStatus;
  tenantId?: string;
  saasId?: string;
  saasSlug?: string;
  reason?: string;
  correlationId: string;
  normalizedHost: string;
  wasWww: boolean;
};

function generateCorrelationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `corr_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function mapDomainStatus(status: string): { status: HostResolutionStatus; reason?: string } {
  const normalized = status.trim().toLowerCase();
  if (normalized === "active") return { status: "ACTIVE" };
  if (normalized === "paused") return { status: "PAUSED", reason: "DOMAIN_PAUSED" };
  if (normalized === "error" || normalized === "error_check") {
    return { status: "PENDING", reason: "DOMAIN_ERROR" };
  }
  if (normalized === "pending" || normalized === "pending_dns") {
    return { status: "PENDING", reason: "DOMAIN_PENDING_VERIFICATION" };
  }
  return { status: "PENDING", reason: "DOMAIN_PENDING_VERIFICATION" };
}

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

export async function resolveHostToSaas(hostname: string): Promise<HostResolution> {
  const correlationId = generateCorrelationId();
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

  const rows = await queryAll<DomainRow>(
    "SELECT tenant_id, saas_id, domain, status FROM saas_domains WHERE lower(domain) = ? LIMIT 1",
    normalizedHost,
  );
  const row = rows[0];
  if (!row) {
    return {
      status: "NOT_FOUND",
      reason: "DOMAIN_NOT_FOUND",
      correlationId,
      normalizedHost,
      wasWww: normalized.wasWww,
    };
  }

  const mapped = mapDomainStatus(row.status);
  const saasSlug = await resolveSaasSlug({ tenantId: row.tenant_id, saasId: row.saas_id });

  return {
    status: mapped.status,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    saasSlug,
    reason: mapped.reason,
    correlationId,
    normalizedHost,
    wasWww: normalized.wasWww,
  };
}
