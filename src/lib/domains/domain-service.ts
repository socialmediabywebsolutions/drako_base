import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { run, queryAll } from "@/lib/db";
import { evaluateCustomDomainEntitlement } from "@/lib/domains/entitlement-gate";
import { isProductionEnvironment } from "@/lib/security/production-gate";

export type DomainStatus =
  | "none"
  | "locked"
  | "requested"
  | "verifying"
  | "active"
  | "failed"
  | "pending"
  | "verified"
  | "pending_manual";

type DomainServiceResultBase = {
  ok: boolean;
  code: string;
  message: string;
  correlationId: string;
  domain?: string;
  status: DomainStatus;
  error?: string;
  httpStatus?: number;
};

export type RequestCustomDomainResult = DomainServiceResultBase & {
  token?: string;
  idempotent?: boolean;
};

export type VerifyAndActivateResult = DomainServiceResultBase & {
  prevStatus: DomainStatus;
  newStatus: DomainStatus;
};

export type DomainStatusResult = {
  trial_domain: string;
  custom_domain: string | null;
  status: DomainStatus;
  verification: {
    token: string | null;
    prefix: string;
    instruction: string;
  };
  last_checked: string | null;
  error: string | null;
  correlationId: string;
};

export class DomainServiceError extends Error {
  code: string;
  httpStatus: number;
  correlationId: string;

  constructor(input: { code: string; message: string; httpStatus: number; correlationId: string }) {
    super(input.message);
    this.name = "DomainServiceError";
    this.code = input.code;
    this.httpStatus = input.httpStatus;
    this.correlationId = input.correlationId;
  }
}

type DomainServiceRuntime = {
  envOverride?: DracoEnv | null;
  correlationId?: string;
  fetchImpl?: typeof fetch;
};

type VerifyOptions = DomainServiceRuntime & {
  forceRecheck?: boolean;
};

type DomainRow = {
  id: string;
  tenant_id: string;
  slug: string;
  trial_domain: string | null;
  custom_domain: string | null;
  domain_verify_token: string | null;
  domain_status: string | null;
  domain_last_checked_at: string | null;
  domain_error: string | null;
};

type CloudflareCustomHostname = {
  id: string;
  hostname: string;
  status?: string;
  ssl?: {
    status?: string;
  };
};

type CloudflareEnvelope<T> = {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: T;
};

const DEFAULT_BASE_DOMAIN = "drako.systems";
const DEFAULT_VERIFY_PREFIX = "drako-verify";
const DEFAULT_VERIFY_SALT = "drako-domain-salt";
const DOMAIN_PATTERN = /^(?=.{4,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function generateCorrelationId(explicit?: string): string {
  if (explicit && explicit.trim()) return explicit.trim();
  return globalThis.crypto?.randomUUID?.() ?? `domain_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function resolveEnvValue(key: string, envOverride?: DracoEnv | null): string | undefined {
  const fromBindingRaw = envOverride ? (envOverride as unknown as Record<string, unknown>)[key] : undefined;
  const fromBinding = typeof fromBindingRaw === "string" ? fromBindingRaw : undefined;
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  const value = fromBinding ?? fromProcess;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveCloudflareValue(key: string, envOverride?: DracoEnv | null): string | undefined {
  const legacyKey = key.replace("CLOUDFLARE_", "CF_");
  return resolveEnvValue(key, envOverride) ?? resolveEnvValue(legacyKey, envOverride);
}

function getBaseDomain(envOverride?: DracoEnv | null): string {
  return (resolveEnvValue("DRAKO_BASE_DOMAIN", envOverride) ?? DEFAULT_BASE_DOMAIN).toLowerCase();
}

function getVerifyPrefix(envOverride?: DracoEnv | null): string {
  return (resolveEnvValue("DOMAIN_VERIFY_PREFIX", envOverride) ?? DEFAULT_VERIFY_PREFIX).toLowerCase();
}

function getVerifySalt(envOverride?: DracoEnv | null): string {
  return resolveEnvValue("DOMAIN_VERIFY_SALT", envOverride) ?? DEFAULT_VERIFY_SALT;
}

function normalizeDomainStatus(status: string | null | undefined): DomainStatus {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "requested" || normalized === "pending") return "requested";
  if (normalized === "verifying" || normalized === "verified" || normalized === "pending_manual") return "verifying";
  if (normalized === "active") return "active";
  if (normalized === "failed") return "failed";
  if (normalized === "locked") return "locked";
  return "none";
}

function normalizeHostname(raw: string): string | null {
  const normalized = raw.trim().toLowerCase().replace(/\.$/, "");
  if (!normalized || normalized.includes("/") || normalized.includes(":") || normalized.includes("http")) return null;
  if (!DOMAIN_PATTERN.test(normalized)) return null;
  return normalized;
}

function isReservedHostname(hostname: string, baseDomain: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return true;
  if (hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)) return true;
  return false;
}

async function createDeterministicToken(input: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function logDomainEvent(
  tenantId: string,
  saasId: string,
  type: string,
  correlationId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(
    "INSERT INTO domain_events (id, saas_instance_id, tenant_id, type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    saasId,
    tenantId,
    type,
    JSON.stringify({ ...metadata, correlationId }),
    now,
  );
}

async function getSaasDomainRow(tenantId: string, saasId: string): Promise<DomainRow | null> {
  const rows = await queryAll<DomainRow>(
    `SELECT id,
            tenant_id,
            slug,
            trial_domain,
            custom_domain,
            domain_verify_token,
            domain_status,
            domain_last_checked_at,
            domain_error
     FROM saas_instances
     WHERE id = ? AND tenant_id = ?
     LIMIT 1`,
    saasId,
    tenantId,
  );
  return rows[0] ?? null;
}

type CloudflareConfig = {
  token: string | null;
  zoneId: string | null;
};

function resolveCloudflareConfig(envOverride?: DracoEnv | null): CloudflareConfig {
  return {
    token: resolveCloudflareValue("CLOUDFLARE_API_TOKEN", envOverride) ?? null,
    zoneId: resolveCloudflareValue("CLOUDFLARE_ZONE_ID", envOverride) ?? null,
  };
}

async function callCloudflareApi<T>(params: {
  token: string;
  path: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  fetchImpl: typeof fetch;
  correlationId: string;
}): Promise<T> {
  let response: Response;
  try {
    response = await params.fetchImpl(`https://api.cloudflare.com/client/v4${params.path}`, {
      method: params.method ?? "GET",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": "application/json",
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cloudflare request failed";
    throw new DomainServiceError({
      code: "DOMAIN_PROVIDER_UNAVAILABLE",
      message: `Cloudflare provider unavailable: ${message}`,
      httpStatus: 503,
      correlationId: params.correlationId,
    });
  }

  let payload: CloudflareEnvelope<T>;
  try {
    payload = (await response.json()) as CloudflareEnvelope<T>;
  } catch {
    throw new DomainServiceError({
      code: "DOMAIN_PROVIDER_INVALID_RESPONSE",
      message: "Cloudflare provider returned invalid JSON",
      httpStatus: 502,
      correlationId: params.correlationId,
    });
  }

  if (!response.ok || !payload.success) {
    const firstError = payload.errors?.[0]?.message ?? `Cloudflare API ${response.status}`;
    throw new DomainServiceError({
      code: "DOMAIN_PROVIDER_REJECTED",
      message: `Cloudflare provider rejected request: ${firstError}`,
      httpStatus: response.status >= 500 ? 503 : 502,
      correlationId: params.correlationId,
    });
  }

  if (typeof payload.result === "undefined") {
    throw new DomainServiceError({
      code: "DOMAIN_PROVIDER_INVALID_RESPONSE",
      message: "Cloudflare provider response missing result",
      httpStatus: 502,
      correlationId: params.correlationId,
    });
  }

  return payload.result;
}

type EnsureCustomHostnameResult = {
  providerStatus: string;
  providerId: string;
  newlyCreated: boolean;
};

async function ensureCustomHostname(params: {
  domain: string;
  config: CloudflareConfig;
  fetchImpl: typeof fetch;
  correlationId: string;
}): Promise<EnsureCustomHostnameResult> {
  const token = params.config.token;
  const zoneId = params.config.zoneId;
  if (!token || !zoneId) {
    throw new DomainServiceError({
      code: "DOMAIN_PROVIDER_MISCONFIGURED",
      message: "Cloudflare Custom Hostnames requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID",
      httpStatus: 503,
      correlationId: params.correlationId,
    });
  }

  const lookup = await callCloudflareApi<CloudflareCustomHostname[]>({
    token,
    fetchImpl: params.fetchImpl,
    correlationId: params.correlationId,
    path: `/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(params.domain)}`,
  });

  const existing = lookup[0];
  if (existing) {
    return {
      providerStatus: (existing.status ?? existing.ssl?.status ?? "pending").toLowerCase(),
      providerId: existing.id,
      newlyCreated: false,
    };
  }

  const created = await callCloudflareApi<CloudflareCustomHostname>({
    token,
    fetchImpl: params.fetchImpl,
    correlationId: params.correlationId,
    method: "POST",
    path: `/zones/${zoneId}/custom_hostnames`,
    body: {
      hostname: params.domain,
      ssl: {
        method: "http",
        type: "dv",
      },
    },
  });

  return {
    providerStatus: (created.status ?? created.ssl?.status ?? "pending").toLowerCase(),
    providerId: created.id,
    newlyCreated: true,
  };
}

function mapProviderStatusToDomainStatus(providerStatus: string): DomainStatus {
  if (providerStatus === "active") return "active";
  if (providerStatus === "pending" || providerStatus === "initializing" || providerStatus === "pending_validation") {
    return "verifying";
  }
  return "failed";
}

async function resolveTxtRecord(domain: string, prefix: string, fetchImpl: typeof fetch): Promise<string[]> {
  const query = `${prefix}.${domain}`;
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(query)}&type=TXT`;
  try {
    const response = await fetchImpl(url, { headers: { Accept: "application/dns-json" } });
    const payload = (await response.json()) as { Answer?: Array<{ data: string }> };
    if (!payload.Answer) return [];
    return payload.Answer.map((entry) => entry.data.replace(/^"|"$/g, ""));
  } catch {
    return [];
  }
}

export function getTrialDomain(slug: string, runtime?: DomainServiceRuntime): string {
  return `${slug}.${getBaseDomain(runtime?.envOverride ?? resolveEnv())}`;
}

export async function requestCustomDomain(
  tenantId: string,
  saasId: string,
  domainInput: string,
  runtime: DomainServiceRuntime = {},
): Promise<RequestCustomDomainResult> {
  const correlationId = generateCorrelationId(runtime.correlationId);
  const envOverride = runtime.envOverride ?? resolveEnv();
  const baseDomain = getBaseDomain(envOverride);

  const domain = normalizeHostname(domainInput);
  if (!domain) {
    return {
      ok: false,
      code: "INVALID_DOMAIN",
      message: "Invalid domain format. Use hostname only (e.g. app.client.com)",
      correlationId,
      status: "failed",
      error: "Invalid domain format. Use hostname only (e.g. app.client.com)",
      httpStatus: 400,
    };
  }

  if (isReservedHostname(domain, baseDomain)) {
    return {
      ok: false,
      code: "DOMAIN_RESERVED",
      message: "Reserved domain cannot be attached",
      correlationId,
      domain,
      status: "failed",
      error: "Reserved domain cannot be attached",
      httpStatus: 403,
    };
  }

  const saas = await getSaasDomainRow(tenantId, saasId);
  if (!saas) {
    return {
      ok: false,
      code: "SAAS_NOT_FOUND",
      message: "SaaS instance not found for tenant",
      correlationId,
      domain,
      status: "none",
      error: "SaaS instance not found for tenant",
      httpStatus: 404,
    };
  }

  const entitlement = await evaluateCustomDomainEntitlement({ tenantId, saasId });
  if (!entitlement.allowed) {
    return {
      ok: false,
      code: entitlement.code,
      message: entitlement.message,
      correlationId,
      domain,
      status: entitlement.code === "SAAS_NOT_FOUND" ? "none" : "locked",
      error: entitlement.message,
      httpStatus: entitlement.code === "SAAS_NOT_FOUND" ? 404 : 403,
    };
  }

  const existing = await queryAll<{ id: string; tenant_id: string }>(
    "SELECT id, tenant_id FROM saas_instances WHERE lower(custom_domain) = lower(?) AND id != ? LIMIT 1",
    domain,
    saasId,
  );
  if (existing.length > 0) {
    return {
      ok: false,
      code: "DOMAIN_ALREADY_CLAIMED",
      message: "Domain already claimed by another SaaS instance",
      correlationId,
      domain,
      status: "failed",
      error: "Domain already claimed by another SaaS instance",
      httpStatus: 409,
    };
  }

  const currentStatus = normalizeDomainStatus(saas.domain_status);
  const currentDomain = (saas.custom_domain ?? "").trim().toLowerCase();
  if (currentDomain === domain && ["requested", "verifying", "active"].includes(currentStatus)) {
    return {
      ok: true,
      code: "DOMAIN_REQUEST_IDEMPOTENT",
      message: "Domain request already exists for this SaaS",
      correlationId,
      domain,
      status: currentStatus,
      token: saas.domain_verify_token ?? undefined,
      idempotent: true,
      httpStatus: 200,
    };
  }

  const verifySalt = getVerifySalt(envOverride);
  const token = await createDeterministicToken(`${tenantId}:${saasId}:${domain}:${verifySalt}`);
  const nowIso = new Date().toISOString();
  const ok = await run(
    `UPDATE saas_instances
     SET custom_domain = ?,
         domain_verify_token = ?,
         domain_status = 'requested',
         domain_error = NULL,
         domain_last_checked_at = ?,
         domain_provider = 'cloudflare_custom_hostnames'
     WHERE id = ? AND tenant_id = ?`,
    domain,
    token,
    nowIso,
    saasId,
    tenantId,
  );

  if (!ok) {
    return {
      ok: false,
      code: "DOMAIN_REQUEST_PERSIST_FAILED",
      message: "Failed to persist domain request",
      correlationId,
      domain,
      status: "failed",
      error: "Failed to persist domain request",
      httpStatus: 500,
    };
  }

  await logDomainEvent(tenantId, saasId, "DOMAIN_REQUESTED", correlationId, { domain, token, status: "requested" });

  return {
    ok: true,
    code: "DOMAIN_REQUEST_ACCEPTED",
    message: "Domain request accepted",
    correlationId,
    domain,
    status: "requested",
    token,
    httpStatus: 202,
  };
}

export async function verifyAndActivate(
  tenantId: string,
  saasId: string,
  options: VerifyOptions = {},
): Promise<VerifyAndActivateResult> {
  const correlationId = generateCorrelationId(options.correlationId);
  const envOverride = options.envOverride ?? resolveEnv();
  const fetchImpl = options.fetchImpl ?? fetch;
  const verifyPrefix = getVerifyPrefix(envOverride);

  const saas = await getSaasDomainRow(tenantId, saasId);
  if (!saas) {
    return {
      ok: false,
      code: "SAAS_NOT_FOUND",
      message: "SaaS instance not found for tenant",
      correlationId,
      status: "none",
      prevStatus: "none",
      newStatus: "none",
      error: "SaaS instance not found for tenant",
      httpStatus: 404,
    };
  }

  const prevStatus = normalizeDomainStatus(saas.domain_status);
  const domain = saas.custom_domain?.trim().toLowerCase() ?? "";
  const token = saas.domain_verify_token?.trim() ?? "";
  if (!domain || !token) {
    return {
      ok: false,
      code: "DOMAIN_NOT_REQUESTED",
      message: "No custom domain request found",
      correlationId,
      status: prevStatus,
      prevStatus,
      newStatus: prevStatus,
      error: "No custom domain request found",
      httpStatus: 409,
    };
  }

  const entitlement = await evaluateCustomDomainEntitlement({ tenantId, saasId });
  if (!entitlement.allowed) {
    await run(
      "UPDATE saas_instances SET domain_status = 'locked', domain_error = ?, domain_last_checked_at = ? WHERE id = ? AND tenant_id = ?",
      entitlement.message,
      new Date().toISOString(),
      saasId,
      tenantId,
    );
    await logDomainEvent(tenantId, saasId, "DOMAIN_ENTITLEMENT_BLOCKED", correlationId, {
      domain,
      entitlementCode: entitlement.code,
      message: entitlement.message,
    });
    return {
      ok: false,
      code: entitlement.code,
      message: entitlement.message,
      correlationId,
      domain,
      status: "locked",
      prevStatus,
      newStatus: "locked",
      error: entitlement.message,
      httpStatus: entitlement.code === "SAAS_NOT_FOUND" ? 404 : 403,
    };
  }

  if (prevStatus === "active" && !options.forceRecheck) {
    return {
      ok: true,
      code: "DOMAIN_ALREADY_ACTIVE",
      message: "Domain is already active",
      correlationId,
      domain,
      status: "active",
      prevStatus: "active",
      newStatus: "active",
      httpStatus: 200,
    };
  }

  const nowIso = new Date().toISOString();
  await run(
    "UPDATE saas_instances SET domain_status = 'verifying', domain_error = NULL, domain_last_checked_at = ? WHERE id = ? AND tenant_id = ?",
    nowIso,
    saasId,
    tenantId,
  );

  const txtRecords = await resolveTxtRecord(domain, verifyPrefix, fetchImpl);
  if (!txtRecords.includes(token)) {
    const message = `TXT record not found for ${verifyPrefix}.${domain}`;
    await run(
      "UPDATE saas_instances SET domain_status = 'verifying', domain_error = ?, domain_last_checked_at = ? WHERE id = ? AND tenant_id = ?",
      message,
      nowIso,
      saasId,
      tenantId,
    );
    await logDomainEvent(tenantId, saasId, "DOMAIN_DNS_PENDING", correlationId, {
      domain,
      verifyPrefix,
      expectedToken: token,
    });
    return {
      ok: true,
      code: "DOMAIN_DNS_PENDING",
      message,
      correlationId,
      domain,
      status: "verifying",
      prevStatus,
      newStatus: "verifying",
      httpStatus: 202,
    };
  }

  const cloudflareConfig = resolveCloudflareConfig(envOverride);
  const productionRuntime = isProductionEnvironment(envOverride);
  if (!cloudflareConfig.token || !cloudflareConfig.zoneId) {
    if (productionRuntime) {
      throw new DomainServiceError({
        code: "DOMAIN_PROVIDER_MISCONFIGURED",
        message: "Cloudflare provider is not configured for production domain activation",
        httpStatus: 503,
        correlationId,
      });
    }

    await logDomainEvent(tenantId, saasId, "DOMAIN_PROVIDER_SKIPPED", correlationId, {
      domain,
      reason: "Provider credentials missing in non-production",
    });
    return {
      ok: true,
      code: "DOMAIN_PROVIDER_SKIPPED",
      message: "Domain verification passed; provider activation skipped outside production",
      correlationId,
      domain,
      status: "verifying",
      prevStatus,
      newStatus: "verifying",
      httpStatus: 202,
    };
  }

  try {
    const provider = await ensureCustomHostname({
      domain,
      config: cloudflareConfig,
      fetchImpl,
      correlationId,
    });

    const nextStatus = mapProviderStatusToDomainStatus(provider.providerStatus);
    const providerMessage =
      nextStatus === "active"
        ? "Domain activated via Cloudflare Custom Hostnames"
        : "Domain attached to Cloudflare and pending verification";

    await run(
      "UPDATE saas_instances SET domain_status = ?, domain_error = ?, domain_last_checked_at = ?, domain_provider = 'cloudflare_custom_hostnames' WHERE id = ? AND tenant_id = ?",
      nextStatus,
      nextStatus === "failed" ? `Provider status: ${provider.providerStatus}` : null,
      nowIso,
      saasId,
      tenantId,
    );

    await logDomainEvent(
      tenantId,
      saasId,
      nextStatus === "active" ? "DOMAIN_ACTIVATED" : "DOMAIN_PROVIDER_PENDING",
      correlationId,
      {
        domain,
        providerId: provider.providerId,
        providerStatus: provider.providerStatus,
        newlyCreated: provider.newlyCreated,
      },
    );

    return {
      ok: true,
      code: nextStatus === "active" ? "DOMAIN_ACTIVE" : "DOMAIN_PROVIDER_PENDING",
      message: providerMessage,
      correlationId,
      domain,
      status: nextStatus,
      prevStatus,
      newStatus: nextStatus,
      httpStatus: nextStatus === "active" ? 200 : 202,
    };
  } catch (error) {
    const serviceError =
      error instanceof DomainServiceError
        ? error
        : new DomainServiceError({
            code: "DOMAIN_PROVIDER_UNAVAILABLE",
            message: error instanceof Error ? error.message : "Cloudflare provider unavailable",
            httpStatus: 503,
            correlationId,
          });

    await run(
      "UPDATE saas_instances SET domain_status = 'failed', domain_error = ?, domain_last_checked_at = ? WHERE id = ? AND tenant_id = ?",
      serviceError.message,
      nowIso,
      saasId,
      tenantId,
    );
    await logDomainEvent(tenantId, saasId, "DOMAIN_FAILED", correlationId, {
      domain,
      code: serviceError.code,
      message: serviceError.message,
    });

    throw serviceError;
  }
}

export async function getDomainStatus(
  tenantId: string,
  saasId: string,
  runtime: DomainServiceRuntime = {},
): Promise<DomainStatusResult | null> {
  const correlationId = generateCorrelationId(runtime.correlationId);
  const envOverride = runtime.envOverride ?? resolveEnv();
  const verifyPrefix = getVerifyPrefix(envOverride);

  const row = await getSaasDomainRow(tenantId, saasId);
  if (!row) return null;

  const domainStatus = normalizeDomainStatus(row.domain_status);
  const customDomain = row.custom_domain?.trim().toLowerCase() ?? null;
  const trialDomain = row.trial_domain?.trim() || getTrialDomain(row.slug, { envOverride });

  return {
    trial_domain: trialDomain,
    custom_domain: customDomain,
    status: domainStatus,
    verification: {
      token: row.domain_verify_token,
      prefix: verifyPrefix,
      instruction: customDomain
        ? `Add a TXT record for ${verifyPrefix}.${customDomain} with value: ${row.domain_verify_token ?? ""}`
        : "No custom domain requested",
    },
    last_checked: row.domain_last_checked_at,
    error: row.domain_error,
    correlationId,
  };
}
