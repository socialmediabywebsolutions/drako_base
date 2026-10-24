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

export type LegacyAliasTelemetryRecord = {
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
  sensitiveDataRedacted: boolean;
};

export type LegacyAliasCutCriteriaInput = {
  observationWindowDays?: number;
  now?: string;
  canonicalTargetExists?: boolean;
  rollbackPathExists?: boolean;
  monitoringActive?: boolean;
  callersMigrated?: boolean;
  humanApprovalRecorded?: boolean;
  observationWindowComplete?: boolean;
  additionalBlockers?: string[];
};

export type LegacyAliasCutAssessment = {
  aliasType: LegacyAliasType;
  totalHits: number;
  recentHits: number;
  lastSeenAt: string | null;
  requiresHumanApproval: true;
  readyForCut: boolean;
  candidateForCut: boolean;
  blockers: string[];
  criteria: {
    canonicalTargetExists: boolean;
    rollbackPathExists: boolean;
    monitoringActive: boolean;
    callersMigrated: boolean;
    humanApprovalRecorded: boolean;
    observationWindowComplete: boolean;
    observationWindowDays: number;
  };
};

export type LegacyAliasUsageSummary = {
  totalHits: number;
  hitsByAliasType: Record<LegacyAliasType, number>;
  hitsByLegacyPath: Record<string, number>;
  hitsByCanonicalTarget: Record<string, number>;
  lastSeenAt: string | null;
  uniqueSourcesApprox: number;
  sensitiveDataRedactedCount: number;
  unknownSourceCount: number;
  candidateForCut: boolean;
  blockers: string[];
  readyForCut: boolean;
  requiresHumanApproval: true;
  byAlias: Record<LegacyAliasType, LegacyAliasCutAssessment>;
  status: "NO_DATA" | "DATA";
};

export type LegacyAliasUsageSummaryInput = {
  events: unknown[];
  now?: string;
  criteriaByAlias?: Partial<Record<LegacyAliasType, LegacyAliasCutCriteriaInput>>;
  observationWindowDays?: number;
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
const KNOWN_ALIAS_TYPES: LegacyAliasType[] = ["owner", "campobase"];
const DEFAULT_CANONICAL_TARGET_BY_ALIAS: Record<LegacyAliasType, string> = {
  owner: "operator-api",
  campobase: "operator-api",
};
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

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toSafeString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function normalizeIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
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

function sanitizeLegacyAliasQueryRecord(input: unknown): Record<string, string> {
  if (!isObject(input)) return {};

  const sanitized: Record<string, string> = {};
  for (const [queryKey, queryValue] of Object.entries(input)) {
    if (queryKey in sanitized) continue;
    sanitized[queryKey] = sanitizeQueryValue(queryKey, toSafeString(queryValue));
  }
  return sanitized;
}

function normalizeLegacyAliasSource(input: unknown): LegacyAliasSource {
  if (input === "internal" || input === "browser" || input === "test" || input === "service") {
    return input;
  }
  return "unknown";
}

function normalizeAliasType(input: unknown): LegacyAliasType | null {
  if (input === "owner" || input === "campobase") return input;
  return null;
}

function resolveAliasTypeFromPath(pathValue: unknown): LegacyAliasType | null {
  if (typeof pathValue !== "string") return null;
  if (pathValue === "/api/owner" || pathValue.startsWith("/api/owner/")) return "owner";
  if (pathValue === "/api/campobase" || pathValue.startsWith("/api/campobase/")) return "campobase";
  return null;
}

function resolveLegacyEventPayload(rawEvent: unknown): Record<string, unknown> | null {
  if (!isObject(rawEvent)) return null;

  const rawType = toSafeString(rawEvent.eventType || rawEvent.type || rawEvent.event);
  const metadata = isObject(rawEvent.metadata) ? rawEvent.metadata : null;
  const payload = metadata ?? rawEvent;
  const payloadType = toSafeString(payload.eventType || payload.type || rawType);
  const routeHitType = payloadType === "legacy.compat.route.hit" || rawType === "legacy.compat.route.hit";
  const routeHitLogEvent = rawType === "LEGACY_COMPAT_ROUTE_HIT";
  if (!routeHitType && !routeHitLogEvent) return null;
  return payload;
}

export function normalizeLegacyAliasTelemetryEvent(rawEvent: unknown): LegacyAliasTelemetryRecord | null {
  const payload = resolveLegacyEventPayload(rawEvent);
  if (!payload) return null;

  const legacyPath = toSafeString(payload.legacyPath);
  if (!legacyPath) return null;

  const normalizedAlias = normalizeAliasType(payload.aliasType) ?? resolveAliasTypeFromPath(legacyPath);
  if (!normalizedAlias) return null;

  const canonicalTarget = toSafeString(payload.canonicalTarget) || DEFAULT_CANONICAL_TARGET_BY_ALIAS[normalizedAlias];
  const timestamp = normalizeIsoTimestamp(payload.timestamp) ?? new Date(0).toISOString();
  const method = toSafeString(payload.method).toUpperCase() || "GET";
  const environment = toSafeString(payload.environment) || "unknown";
  const correlationId = toSafeString(payload.correlationId) || "unknown";
  const source = normalizeLegacyAliasSource(payload.source);
  const host = toSafeString(payload.host) || "unknown";
  const hostMode = toSafeString(payload.hostMode) || "unknown";
  const userAgentHashRaw = payload.userAgentHash;
  const userAgentHash = typeof userAgentHashRaw === "string" && userAgentHashRaw.length > 0 ? userAgentHashRaw : null;
  const query = sanitizeLegacyAliasQueryRecord(payload.query);
  const sensitiveDataRedacted = payload.sensitiveDataRedacted !== false;

  return {
    eventType: "legacy.compat.route.hit",
    aliasType: normalizedAlias,
    legacyPath,
    canonicalTarget,
    method,
    timestamp,
    environment,
    correlationId,
    source,
    host,
    hostMode,
    userAgentHash,
    query,
    sensitiveDataRedacted,
  };
}

export function normalizeLegacyAliasTelemetryEvents(rawEvents: unknown[]): LegacyAliasTelemetryRecord[] {
  return rawEvents
    .map((item) => normalizeLegacyAliasTelemetryEvent(item))
    .filter((event): event is LegacyAliasTelemetryRecord => Boolean(event));
}

function incrementCount(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

function resolveObservationWindowDays(
  globalDays: number | undefined,
  localDays: number | undefined,
): number {
  const fromLocal = typeof localDays === "number" && localDays > 0 ? localDays : null;
  const fromGlobal = typeof globalDays === "number" && globalDays > 0 ? globalDays : null;
  return fromLocal ?? fromGlobal ?? 7;
}

function evaluateLegacyAliasCutAssessment(params: {
  aliasType: LegacyAliasType;
  events: LegacyAliasTelemetryRecord[];
  nowIso: string;
  globalObservationWindowDays: number | undefined;
  criteria: LegacyAliasCutCriteriaInput | undefined;
}): LegacyAliasCutAssessment {
  const observationWindowDays = resolveObservationWindowDays(
    params.globalObservationWindowDays,
    params.criteria?.observationWindowDays,
  );
  const nowDate = new Date(params.criteria?.now ?? params.nowIso);
  const windowStart = new Date(nowDate.getTime() - observationWindowDays * 24 * 60 * 60 * 1000);
  const aliasEvents = params.events.filter((event) => event.aliasType === params.aliasType);
  const recentEvents = aliasEvents.filter((event) => new Date(event.timestamp).getTime() >= windowStart.getTime());
  const lastSeenAt = aliasEvents.reduce<string | null>((latest, current) => {
    if (!latest) return current.timestamp;
    return current.timestamp > latest ? current.timestamp : latest;
  }, null);

  const canonicalTargetExists = params.criteria?.canonicalTargetExists ?? true;
  const rollbackPathExists = params.criteria?.rollbackPathExists ?? false;
  const monitoringActive = params.criteria?.monitoringActive ?? false;
  const callersMigrated = params.criteria?.callersMigrated ?? false;
  const humanApprovalRecorded = params.criteria?.humanApprovalRecorded ?? false;
  const observationWindowComplete = params.criteria?.observationWindowComplete ?? false;
  const requiresHumanApproval = true;
  const zeroHitsInObservationWindow = recentEvents.length === 0;

  const blockers: string[] = [];
  if (!zeroHitsInObservationWindow && !callersMigrated) blockers.push("RECENT_HITS_PRESENT");
  if (recentEvents.some((event) => event.source === "unknown")) blockers.push("UNKNOWN_SOURCE_RECENT_ACTIVITY");
  if (!canonicalTargetExists) blockers.push("CANONICAL_TARGET_MISSING");
  if (!rollbackPathExists) blockers.push("ROLLBACK_PATH_MISSING");
  if (!monitoringActive) blockers.push("MONITORING_NOT_ACTIVE");
  if (!observationWindowComplete) blockers.push("OBSERVATION_WINDOW_INCOMPLETE");
  if (!humanApprovalRecorded) blockers.push("HUMAN_APPROVAL_NOT_RECORDED");
  if (params.criteria?.additionalBlockers?.length) blockers.push(...params.criteria.additionalBlockers);

  const candidateForCut = zeroHitsInObservationWindow || callersMigrated;
  const readyForCut = candidateForCut && blockers.length === 0;

  return {
    aliasType: params.aliasType,
    totalHits: aliasEvents.length,
    recentHits: recentEvents.length,
    lastSeenAt,
    requiresHumanApproval,
    readyForCut,
    candidateForCut,
    blockers,
    criteria: {
      canonicalTargetExists,
      rollbackPathExists,
      monitoringActive,
      callersMigrated,
      humanApprovalRecorded,
      observationWindowComplete,
      observationWindowDays,
    },
  };
}

export function summarizeLegacyAliasUsage(input: LegacyAliasUsageSummaryInput): LegacyAliasUsageSummary {
  const normalizedEvents = normalizeLegacyAliasTelemetryEvents(input.events);
  const nowIso = new Date(input.now ?? new Date().toISOString()).toISOString();
  const hitsByAliasType: Record<LegacyAliasType, number> = { owner: 0, campobase: 0 };
  const hitsByLegacyPath: Record<string, number> = {};
  const hitsByCanonicalTarget: Record<string, number> = {};
  const sources = new Set<string>();
  let sensitiveDataRedactedCount = 0;
  let unknownSourceCount = 0;
  let lastSeenAt: string | null = null;

  for (const event of normalizedEvents) {
    hitsByAliasType[event.aliasType] += 1;
    incrementCount(hitsByLegacyPath, event.legacyPath);
    incrementCount(hitsByCanonicalTarget, event.canonicalTarget);
    sources.add(event.source);
    if (event.sensitiveDataRedacted) sensitiveDataRedactedCount += 1;
    if (event.source === "unknown") unknownSourceCount += 1;
    if (!lastSeenAt || event.timestamp > lastSeenAt) lastSeenAt = event.timestamp;
  }

  const ownerAssessment = evaluateLegacyAliasCutAssessment({
    aliasType: "owner",
    events: normalizedEvents,
    nowIso,
    globalObservationWindowDays: input.observationWindowDays,
    criteria: input.criteriaByAlias?.owner,
  });
  const campobaseAssessment = evaluateLegacyAliasCutAssessment({
    aliasType: "campobase",
    events: normalizedEvents,
    nowIso,
    globalObservationWindowDays: input.observationWindowDays,
    criteria: input.criteriaByAlias?.campobase,
  });

  const byAlias = {
    owner: ownerAssessment,
    campobase: campobaseAssessment,
  };

  const blockers = Array.from(new Set([...ownerAssessment.blockers, ...campobaseAssessment.blockers]));
  const candidateForCut = ownerAssessment.candidateForCut && campobaseAssessment.candidateForCut;
  const readyForCut = ownerAssessment.readyForCut && campobaseAssessment.readyForCut;

  return {
    totalHits: normalizedEvents.length,
    hitsByAliasType,
    hitsByLegacyPath,
    hitsByCanonicalTarget,
    lastSeenAt,
    uniqueSourcesApprox: sources.size,
    sensitiveDataRedactedCount,
    unknownSourceCount,
    candidateForCut,
    blockers,
    readyForCut,
    requiresHumanApproval: true,
    byAlias,
    status: normalizedEvents.length === 0 ? "NO_DATA" : "DATA",
  };
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
