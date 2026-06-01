import type { DracoEnv } from "@/lib/cf";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";

export type LegacyAliasType = "owner" | "campobase";

export type LegacyAliasSource = "unknown" | "internal" | "browser" | "test" | "service";

export type LegacyAliasTelemetryEvent = {
  eventType: "legacy.compat.route.hit";
  aliasType: LegacyAliasType;
  legacyPath: string;
  canonicalTarget: string;
  method: string;
  timestamp: string;
  environment: string;
  correlationId: string;
  source: LegacyAliasSource;
  host: string;
  hostMode: string;
  userAgentHash: string | null;
  query: Record<string, string>;
  sensitiveDataRedacted: true;
};

export type LegacyAliasRequestContext = {
  headers: { get(name: string): string | null };
  nextUrl: { searchParams: URLSearchParams };
};

export type LegacyAliasUsageTelemetryInput = {
  requestBindings: DracoEnv | null;
  aliasType: LegacyAliasType;
  legacyPath: string;
  canonicalTarget: string;
  method: string;
  correlationId: string;
  host: string;
  hostMode: string;
  request: LegacyAliasRequestContext;
  sampleRate?: number;
};

export type LegacyAliasTelemetrySink = (event: LegacyAliasTelemetryEvent) => void | Promise<void>;

const REDACTED_VALUE = "[REDACTED]";
const USER_AGENT_MAX_LENGTH = 256;
const QUERY_VALUE_MAX_LENGTH = 128;
const SENSITIVE_QUERY_KEY_PATTERN =
  /(?:token|secret|password|passwd|pwd|auth|authorization|cookie|session|apikey|api_key|client_secret|signature|sig|jwt|code|state|refresh|access|id_token|bearer)/i;
const SENSITIVE_QUERY_VALUE_PATTERN =
  /(?:bearer\s+[a-z0-9._~-]+|eyj[a-z0-9._-]{8,}|sk_[a-z0-9]{8,}|xox[baprs]-[a-z0-9-]+)/i;

let telemetrySink: LegacyAliasTelemetrySink | null = null;

export function setLegacyAliasTelemetrySinkForTests(sink: LegacyAliasTelemetrySink | null): void {
  telemetrySink = sink;
}

function safeWarn(message: string, payload: unknown): void {
  try {
    console.warn(message, payload);
  } catch {
    // Logger failures must never break request flow.
  }
}

function normalizeSampleRate(sampleRate: number | undefined): number {
  if (typeof sampleRate !== "number" || Number.isNaN(sampleRate)) return 1;
  if (sampleRate <= 0) return 0;
  if (sampleRate >= 1) return 1;
  return sampleRate;
}

function shouldSample(sampleRate: number): boolean {
  if (sampleRate <= 0) return false;
  if (sampleRate >= 1) return true;
  return Math.random() <= sampleRate;
}

function resolveEnvironment(requestBindings: DracoEnv | null): string {
  const bindingEnvironment = requestBindings?.ENVIRONMENT ?? requestBindings?.CF_PAGES_ENVIRONMENT;
  if (bindingEnvironment && bindingEnvironment.trim().length > 0) {
    return bindingEnvironment.trim();
  }

  if (typeof process !== "undefined") {
    return process.env.CF_PAGES_ENVIRONMENT ?? process.env.NODE_ENV ?? "unknown";
  }

  return "unknown";
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function inferSource(request: LegacyAliasRequestContext, userAgent: string): LegacyAliasSource {
  const internalSignal =
    request.headers.get("x-drako-internal-request")
    ?? request.headers.get("x-internal-request")
    ?? request.headers.get("x-drako-source");
  if (internalSignal) return "internal";

  const ua = userAgent.toLowerCase();
  if (!ua) return "unknown";
  if (/(?:vitest|jest|playwright|cypress|node-fetch|undici)/.test(ua)) return "test";
  if (/(?:mozilla|chrome|safari|firefox|edg|opr)/.test(ua)) return "browser";
  if (/(?:curl|postmanruntime|insomnia|httpie|okhttp|python-requests|go-http-client)/.test(ua)) {
    return "service";
  }
  return "service";
}

function sanitizeQueryValue(queryKey: string, queryValue: string): string {
  if (SENSITIVE_QUERY_KEY_PATTERN.test(queryKey) || SENSITIVE_QUERY_VALUE_PATTERN.test(queryValue)) {
    return REDACTED_VALUE;
  }
  if (queryValue.length <= QUERY_VALUE_MAX_LENGTH) {
    return queryValue;
  }
  return `${queryValue.slice(0, QUERY_VALUE_MAX_LENGTH)}...[truncated]`;
}

export function sanitizeLegacyAliasQueryParams(searchParams: URLSearchParams): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [queryKey, queryValue] of searchParams.entries()) {
    if (queryKey in sanitized) continue;
    sanitized[queryKey] = sanitizeQueryValue(queryKey, queryValue);
  }
  return sanitized;
}

export function buildLegacyAliasTelemetryEvent(input: LegacyAliasUsageTelemetryInput): LegacyAliasTelemetryEvent {
  const userAgent = (input.request.headers.get("user-agent") ?? "").slice(0, USER_AGENT_MAX_LENGTH);
  const source = inferSource(input.request, userAgent);
  const sanitizedQuery = sanitizeLegacyAliasQueryParams(input.request.nextUrl.searchParams);

  return {
    eventType: "legacy.compat.route.hit",
    aliasType: input.aliasType,
    legacyPath: input.legacyPath,
    canonicalTarget: input.canonicalTarget,
    method: input.method.toUpperCase(),
    timestamp: new Date().toISOString(),
    environment: resolveEnvironment(input.requestBindings),
    correlationId: input.correlationId,
    source,
    host: input.host,
    hostMode: input.hostMode,
    userAgentHash: userAgent ? stableHash(userAgent) : null,
    query: sanitizedQuery,
    sensitiveDataRedacted: true,
  };
}

function isTestEnvironment(): boolean {
  return typeof process !== "undefined" && process.env.NODE_ENV === "test";
}

export async function recordLegacyAliasUsageTelemetry(input: LegacyAliasUsageTelemetryInput): Promise<void> {
  const sampleRate = normalizeSampleRate(input.sampleRate);
  if (!shouldSample(sampleRate)) return;

  const event = buildLegacyAliasTelemetryEvent(input);

  if (telemetrySink) {
    try {
      await telemetrySink(event);
    } catch (error) {
      safeWarn("LEGACY_COMPAT_TEST_SINK_FAILED", error);
    }
  }

  safeWarn("LEGACY_COMPAT_ROUTE_HIT", event);

  if (isTestEnvironment() || !input.requestBindings?.DRACO_DB) {
    return;
  }

  try {
    await recordCampamentoEvent({
      tenantId: DEMO_TENANT_ID,
      saasId: null,
      type: event.eventType,
      severity: "WARNING",
      source: "MIDDLEWARE",
      message: `Legacy compat route hit: ${event.legacyPath}`,
      metadata: event,
      correlationId: event.correlationId,
      createdAt: event.timestamp,
    });
  } catch (error) {
    safeWarn("LEGACY_COMPAT_ROUTE_EVENT_FALLBACK", error);
  }
}
