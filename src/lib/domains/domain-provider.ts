import type { DracoEnv } from "@/lib/cf";

type ProviderMethod = "GET" | "POST" | "DELETE";

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

export type DomainBindingInput = {
  hostname: string;
  bindingId?: string;
  correlationId?: string;
  envOverride?: DracoEnv | null;
  fetchImpl?: typeof fetch;
};

export type DomainBindingResult = {
  hostname: string;
  bindingId: string | null;
  providerStatus: string;
  alreadyExists?: boolean;
  deleted?: boolean;
};

export class DomainProviderError extends Error {
  code: string;
  httpStatus: number;
  correlationId: string;

  constructor(params: { code: string; message: string; httpStatus: number; correlationId: string }) {
    super(params.message);
    this.name = "DomainProviderError";
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    this.correlationId = params.correlationId;
  }
}

function resolveCorrelationId(explicit?: string): string {
  if (explicit && explicit.trim()) return explicit.trim();
  return globalThis.crypto?.randomUUID?.() ?? `domain_provider_${Date.now()}`;
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

function resolveCloudflareConfig(envOverride?: DracoEnv | null): { token: string | null; zoneId: string | null } {
  const token = resolveEnvValue("CLOUDFLARE_API_TOKEN", envOverride) ?? resolveEnvValue("CF_API_TOKEN", envOverride) ?? null;
  const zoneId = resolveEnvValue("CLOUDFLARE_ZONE_ID", envOverride) ?? resolveEnvValue("CF_ZONE_ID", envOverride) ?? null;
  return { token, zoneId };
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

function normalizeProviderStatus(status?: string, sslStatus?: string): string {
  return (status ?? sslStatus ?? "pending").toLowerCase();
}

async function callCloudflareApi<T>(params: {
  token: string;
  zoneId: string;
  path: string;
  method?: ProviderMethod;
  body?: Record<string, unknown>;
  correlationId: string;
  fetchImpl: typeof fetch;
}): Promise<T> {
  let response: Response;
  try {
    response = await params.fetchImpl(`https://api.cloudflare.com/client/v4/zones/${params.zoneId}${params.path}`, {
      method: params.method ?? "GET",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": "application/json",
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
    });
  } catch (error) {
    throw new DomainProviderError({
      code: "DOMAIN_PROVIDER_UNAVAILABLE",
      message: error instanceof Error ? error.message : "Cloudflare request failed",
      httpStatus: 503,
      correlationId: params.correlationId,
    });
  }

  let payload: CloudflareEnvelope<T>;
  try {
    payload = (await response.json()) as CloudflareEnvelope<T>;
  } catch {
    throw new DomainProviderError({
      code: "DOMAIN_PROVIDER_INVALID_RESPONSE",
      message: "Cloudflare provider returned invalid JSON",
      httpStatus: 502,
      correlationId: params.correlationId,
    });
  }

  if (!response.ok || !payload.success || typeof payload.result === "undefined") {
    const firstError = payload.errors?.[0]?.message ?? `Cloudflare API ${response.status}`;
    throw new DomainProviderError({
      code: "DOMAIN_PROVIDER_REJECTED",
      message: firstError,
      httpStatus: response.status >= 500 ? 503 : 502,
      correlationId: params.correlationId,
    });
  }

  return payload.result;
}

async function lookupByHostname(params: {
  token: string;
  zoneId: string;
  hostname: string;
  correlationId: string;
  fetchImpl: typeof fetch;
}): Promise<CloudflareCustomHostname | null> {
  const result = await callCloudflareApi<CloudflareCustomHostname[]>({
    token: params.token,
    zoneId: params.zoneId,
    path: `/custom_hostnames?hostname=${encodeURIComponent(params.hostname)}`,
    correlationId: params.correlationId,
    fetchImpl: params.fetchImpl,
  });
  return result[0] ?? null;
}

function resolveProviderRuntime(input: DomainBindingInput): {
  token: string;
  zoneId: string;
  correlationId: string;
  fetchImpl: typeof fetch;
  hostname: string;
} {
  const correlationId = resolveCorrelationId(input.correlationId);
  const config = resolveCloudflareConfig(input.envOverride);
  if (!config.token || !config.zoneId) {
    throw new DomainProviderError({
      code: "DOMAIN_PROVIDER_MISCONFIGURED",
      message: "Cloudflare Workers Custom Domains provider is not configured",
      httpStatus: 503,
      correlationId,
    });
  }
  return {
    token: config.token,
    zoneId: config.zoneId,
    correlationId,
    fetchImpl: input.fetchImpl ?? fetch,
    hostname: normalizeHostname(input.hostname),
  };
}

export async function createDomainBinding(input: DomainBindingInput): Promise<DomainBindingResult> {
  const runtime = resolveProviderRuntime(input);
  const existing = await lookupByHostname(runtime);
  if (existing) {
    return {
      hostname: runtime.hostname,
      bindingId: existing.id,
      providerStatus: normalizeProviderStatus(existing.status, existing.ssl?.status),
      alreadyExists: true,
    };
  }

  const created = await callCloudflareApi<CloudflareCustomHostname>({
    token: runtime.token,
    zoneId: runtime.zoneId,
    path: "/custom_hostnames",
    method: "POST",
    body: {
      hostname: runtime.hostname,
      ssl: { method: "http", type: "dv" },
    },
    correlationId: runtime.correlationId,
    fetchImpl: runtime.fetchImpl,
  });

  return {
    hostname: runtime.hostname,
    bindingId: created.id,
    providerStatus: normalizeProviderStatus(created.status, created.ssl?.status),
    alreadyExists: false,
  };
}

export async function verifyDomainBinding(input: DomainBindingInput): Promise<DomainBindingResult> {
  const runtime = resolveProviderRuntime(input);

  let binding: CloudflareCustomHostname | null = null;
  if (input.bindingId && input.bindingId.trim()) {
    binding = await callCloudflareApi<CloudflareCustomHostname>({
      token: runtime.token,
      zoneId: runtime.zoneId,
      path: `/custom_hostnames/${encodeURIComponent(input.bindingId.trim())}`,
      correlationId: runtime.correlationId,
      fetchImpl: runtime.fetchImpl,
    });
  } else {
    binding = await lookupByHostname(runtime);
  }

  if (!binding) {
    throw new DomainProviderError({
      code: "DOMAIN_BINDING_NOT_FOUND",
      message: `Domain binding not found for ${runtime.hostname}`,
      httpStatus: 404,
      correlationId: runtime.correlationId,
    });
  }

  return {
    hostname: runtime.hostname,
    bindingId: binding.id,
    providerStatus: normalizeProviderStatus(binding.status, binding.ssl?.status),
  };
}

export async function deleteDomainBinding(input: DomainBindingInput): Promise<DomainBindingResult> {
  const runtime = resolveProviderRuntime(input);
  const binding = input.bindingId
    ? ({
        id: input.bindingId.trim(),
      } as CloudflareCustomHostname)
    : await lookupByHostname(runtime);

  if (!binding) {
    return {
      hostname: runtime.hostname,
      bindingId: null,
      providerStatus: "not_found",
      deleted: false,
    };
  }

  await callCloudflareApi<{ id: string }>({
    token: runtime.token,
    zoneId: runtime.zoneId,
    path: `/custom_hostnames/${encodeURIComponent(binding.id)}`,
    method: "DELETE",
    correlationId: runtime.correlationId,
    fetchImpl: runtime.fetchImpl,
  });

  return {
    hostname: runtime.hostname,
    bindingId: binding.id,
    providerStatus: "deleted",
    deleted: true,
  };
}
