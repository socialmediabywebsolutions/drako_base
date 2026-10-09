import { getCloudflareContextSafeSync } from "@/lib/cloudflare/runtime";
import { resolveSocialCorsTransport } from "@/lib/capabilities/internal-api-clients/socialcors-transport";
import type {
  InternalApiError,
  SocialFlowAutomationTriggerRequest,
  SocialFlowAutomationTriggerResponse,
  SocialFlowEventRequest,
  SocialFlowEventResponse,
  SocialFlowHealthResponse,
  SocialFlowObservabilitySnapshot,
  SocialFlowOperatorActionRequest,
  SocialFlowOperatorActionResponse,
  SocialFlowTrendTriggersSnapshot,
} from "@/lib/capabilities/internal-api-types/socialflow";

const SOCIALFLOW_HEALTH_PATH = "/api/internal/socialflow/health";
const SOCIALFLOW_OBSERVABILITY_SNAPSHOT_PATH = "/api/internal/socialflow/observability/snapshot";
const SOCIALFLOW_EVENTS_PATH = "/api/internal/socialflow/events";
const SOCIALFLOW_AUTOMATION_TRIGGER_PATH = "/api/internal/socialflow/automation/trigger";
const SOCIALFLOW_OPERATOR_ACTIONS_PATH = "/api/internal/socialflow/operator/actions";
const SOCIALFLOW_TREND_TRIGGERS_PATH = "/api/internal/socialflow/trend-triggers";

type FetchLike = typeof fetch;

export type SocialFlowControlPlaneRequestOptions = {
  baseUrl?: string;
  requestId?: string;
  tenantId?: string | null;
  serviceToken?: string;
  idempotencyKey?: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
};

export class SocialFlowControlPlaneInternalApiError extends Error {
  status: number;
  code: InternalApiError["code"];
  requestId: string;

  constructor(input: {
    status: number;
    code: InternalApiError["code"];
    message: string;
    requestId: string;
  }) {
    super(input.message);
    this.name = "SocialFlowControlPlaneInternalApiError";
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
  }
}

function buildRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sf-control-plane-${Date.now()}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function resolveBaseUrl(input?: string): string {
  const fromInput = input?.trim();
  if (fromInput) {
    return trimTrailingSlash(fromInput);
  }

  const fromEnv =
    process.env.SOCIALFLOW_INTERNAL_API_BASE_URL
    || process.env.INTERNAL_API_BASE_URL
    || process.env.DRAKO_INTERNAL_API_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || `http://127.0.0.1:${process.env.PORT || "3000"}`;

  return trimTrailingSlash(fromEnv);
}

function resolveServiceToken(explicitToken?: string): string | null {
  const fromInput = explicitToken?.trim();
  if (fromInput) {
    return fromInput;
  }

  const fromEnv =
    process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN
    || process.env.INTERNAL_SERVICE_TOKEN
    || process.env.INTERNAL_API_SERVICE_TOKEN
    || null;

  if (fromEnv) {
    return fromEnv;
  }

  if (process.env.NODE_ENV === "test") {
    return process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN_TEST
      || process.env.DRAKO_TEST_SERVICE_TOKEN
      || null;
  }

  return null;
}

function buildHeaders(input: {
  requestId: string;
  serviceToken: string;
  tenantId?: string | null;
  idempotencyKey?: string;
  contentType?: string;
}): Headers {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${input.serviceToken}`);
  // Canonical architecture name is Campamento Base (control plane).
  // Header value `campobase` stays temporarily for v1 internal contract compatibility.
  // Migrate this header value to `campamento-base` in a dedicated follow-up commit.
  headers.set("X-Drako-Control-Plane", "campobase");
  headers.set("X-Drako-Request-Id", input.requestId);

  if (input.tenantId && input.tenantId.trim()) {
    headers.set("X-Drako-Tenant-Id", input.tenantId.trim());
  }

  if (input.idempotencyKey && input.idempotencyKey.trim()) {
    headers.set("Idempotency-Key", input.idempotencyKey.trim());
  }

  if (input.contentType) {
    headers.set("Content-Type", input.contentType);
  }

  return headers;
}

function resolveDefaultCode(status: number): InternalApiError["code"] {
  if (status === 401) return "INTERNAL_API_UNAUTHORIZED";
  if (status === 403) return "INTERNAL_API_FORBIDDEN";
  return "INTERNAL_API_BAD_REQUEST";
}

function resolveDefaultMessage(status: number, path: string): string {
  if (status === 400) return `Invalid request payload for ${path}`;
  if (status === 401) return `Unauthorized request for ${path}`;
  if (status === 403) return `Forbidden request for ${path}`;
  if (status === 404) return `Internal endpoint not found: ${path}`;
  if (status >= 500) return `Internal endpoint failure for ${path}`;
  return `Internal API request failed for ${path}`;
}

function buildErrorFromPayload(input: {
  status: number;
  requestId: string;
  path: string;
  payload: unknown;
}): SocialFlowControlPlaneInternalApiError {
  const payload = input.payload as InternalApiError | null;
  const code = payload?.code ?? resolveDefaultCode(input.status);
  const message = payload?.message ?? resolveDefaultMessage(input.status, input.path);
  const requestId = payload?.requestId ?? input.requestId;

  return new SocialFlowControlPlaneInternalApiError({
    status: input.status,
    code,
    message,
    requestId,
  });
}

async function parseJsonResponse(input: {
  response: Response;
  requestId: string;
  path: string;
}): Promise<unknown> {
  const text = await input.response.text().catch(() => null);
  const contentType = input.response.headers.get("content-type") ?? "unknown";
  const snippet = (text ?? "").slice(0, 300);

  if (!text || !text.trim()) {
    throw new SocialFlowControlPlaneInternalApiError({
      status: input.response.ok ? 500 : input.response.status,
      code: resolveDefaultCode(input.response.status),
      message: `Invalid JSON response from ${input.path} (httpStatus=${input.response.status}, contentType=${contentType}, body=EMPTY)`,
      requestId: input.requestId,
    });
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (parseError) {
    const detail = parseError instanceof Error ? parseError.message : String(parseError);
    throw new SocialFlowControlPlaneInternalApiError({
      status: input.response.ok ? 500 : input.response.status,
      code: resolveDefaultCode(input.response.status),
      message: `Invalid JSON response from ${input.path} (httpStatus=${input.response.status}, contentType=${contentType}, parseError=${detail}, body=${JSON.stringify(snippet)})`,
      requestId: input.requestId,
    });
  }
}

async function requestJson<T>(input: {
  path: string;
  method: "GET" | "POST";
  options: SocialFlowControlPlaneRequestOptions;
  body?: Record<string, unknown>;
}): Promise<T> {
  const requestId = input.options.requestId?.trim() || buildRequestId();
  const serviceToken = resolveServiceToken(input.options.serviceToken);

  if (!serviceToken) {
    throw new SocialFlowControlPlaneInternalApiError({
      status: 401,
      code: "INTERNAL_API_UNAUTHORIZED",
      message: `Missing internal service token for ${input.path}`,
      requestId,
    });
  }

  const transport = resolveSocialCorsTransport({
    baseUrl: input.options.baseUrl,
    fetchImpl: input.options.fetchImpl,
    resolveFallbackBaseUrl: resolveBaseUrl,
  });
  const fetchImpl = transport.fetchImpl;
  const url = `${transport.baseUrl}${input.path}`;

  const headers = buildHeaders({
    requestId,
    serviceToken,
    tenantId: input.options.tenantId,
    idempotencyKey: input.options.idempotencyKey,
    contentType: input.method === "POST" ? "application/json" : undefined,
  });

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: input.method,
      headers,
      cache: "no-store",
      signal: input.options.signal,
      body: input.method === "POST" ? JSON.stringify(input.body ?? {}) : undefined,
    });
  } catch (fetchError) {
    const detail = fetchError instanceof Error ? `${fetchError.name}: ${fetchError.message}` : String(fetchError);
    throw new SocialFlowControlPlaneInternalApiError({
      status: 500,
      code: "INTERNAL_API_BAD_REQUEST",
      message: `Unable to reach internal endpoint ${input.path} (url=${url}): ${detail}`,
      requestId,
    });
  }

  const payload = await parseJsonResponse({
    response,
    requestId,
    path: input.path,
  });

  if (!response.ok) {
    throw buildErrorFromPayload({
      status: response.status,
      requestId,
      path: input.path,
      payload,
    });
  }

  return payload as T;
}

export async function fetchSocialFlowHealth(
  options: SocialFlowControlPlaneRequestOptions = {},
): Promise<SocialFlowHealthResponse> {
  return requestJson<SocialFlowHealthResponse>({
    path: SOCIALFLOW_HEALTH_PATH,
    method: "GET",
    options,
  });
}

export async function fetchSocialFlowObservabilitySnapshot(
  options: SocialFlowControlPlaneRequestOptions & { saasId: string },
): Promise<SocialFlowObservabilitySnapshot> {
  const { saasId, ...requestOptions } = options;
  const path = `${SOCIALFLOW_OBSERVABILITY_SNAPSHOT_PATH}?saasId=${encodeURIComponent(saasId)}`;
  return requestJson<SocialFlowObservabilitySnapshot>({
    path,
    method: "GET",
    options: requestOptions,
  });
}

export async function fetchSocialFlowTrendTriggersSnapshot(
  options: SocialFlowControlPlaneRequestOptions & { limit?: number } = {},
): Promise<SocialFlowTrendTriggersSnapshot> {
  const { limit, ...requestOptions } = options;
  const path = limit
    ? `${SOCIALFLOW_TREND_TRIGGERS_PATH}?limit=${encodeURIComponent(String(limit))}`
    : SOCIALFLOW_TREND_TRIGGERS_PATH;
  return requestJson<SocialFlowTrendTriggersSnapshot>({
    path,
    method: "GET",
    options: requestOptions,
  });
}

export async function postSocialFlowEvent(
  event: SocialFlowEventRequest,
  options: SocialFlowControlPlaneRequestOptions = {},
): Promise<SocialFlowEventResponse> {
  return requestJson<SocialFlowEventResponse>({
    path: SOCIALFLOW_EVENTS_PATH,
    method: "POST",
    options,
    body: event,
  });
}

export async function triggerSocialFlowAutomation(
  request: SocialFlowAutomationTriggerRequest,
  options: SocialFlowControlPlaneRequestOptions = {},
): Promise<SocialFlowAutomationTriggerResponse> {
  return requestJson<SocialFlowAutomationTriggerResponse>({
    path: SOCIALFLOW_AUTOMATION_TRIGGER_PATH,
    method: "POST",
    options,
    body: request,
  });
}

export async function postSocialFlowOperatorAction(
  request: SocialFlowOperatorActionRequest,
  options: SocialFlowControlPlaneRequestOptions = {},
): Promise<SocialFlowOperatorActionResponse> {
  return requestJson<SocialFlowOperatorActionResponse>({
    path: SOCIALFLOW_OPERATOR_ACTIONS_PATH,
    method: "POST",
    options,
    body: request,
  });
}
