/**
 * Canonical Meta (Facebook/Instagram) Graph API primitives for SocialFlow.
 *
 * Mirrors the shape of `@/lib/socialflow/linkedin/core` (error handling,
 * environment resolution, callback/origin resolution, state parsing, token
 * exchange) but scoped to the Meta Graph API: Facebook Page OAuth + the
 * linked Instagram Business Account.
 */
import { env } from "@/lib/cf";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const META_GRAPH_VERSION = "v19.0";
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
// instagram_business_login accounts (direct Instagram Login, no Facebook Page) get
// tokens scoped to graph.instagram.com — calling graph.facebook.com with one of those
// tokens fails. Classic Facebook-Pages accounts keep using META_GRAPH_BASE_URL. Same
// pair of hosts as publishing.ts's IG_GRAPH_BASE/FB_GRAPH_BASE (duplicated here as a
// single URL string, not logic — publishing.ts's FB_GRAPH_BASE has its own unrelated
// uses for Facebook Page posting, so it can't just delegate to this file).
const IG_GRAPH_BASE = "https://graph.instagram.com/v22.0";
const META_CALLBACK_PATH = "/api/socialflow/meta/callback";

// Single source of truth for which Graph API host a call should hit, based on the
// account's stored authType (saas_social_accounts.auth_meta.authType) — every reader of
// Instagram data (insights, recent media, comments) needs this, not just publishing.
// Mirrors the same ternary requireInstagramCredentials already applies in publishing.ts.
export function resolveMetaApiBase(authType: string | null | undefined): string {
  return authType === "instagram_business_login" ? IG_GRAPH_BASE : META_GRAPH_BASE_URL;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MetaCallbackOptions = {
  callbackPath?: string;
};

export type MetaEnvKey =
  | "META_APP_ID"
  | "META_APP_SECRET"
  | "APP_URL"
  | "NEXT_PUBLIC_APP_URL"
  | "BASE_URL"
  | "SITE_URL"
  | "NEXTAUTH_URL"
  | "CF_PAGES_URL";

type MetaResolvedValue = {
  value: string;
  source: string;
};

export type MetaRuntimeKind = "worker-local" | "next-dev-local" | "local" | "worker" | "production";

export type MetaCallbackResolution = {
  callbackUrl: string;
  origin: string;
  originSource: string;
  runtime: MetaRuntimeKind;
};

export type MetaOAuthDiagnostics = MetaCallbackResolution & {
  appId: string;
  appIdSource: string;
  appSecretSource?: string;
};

export type MetaErrorStatus = "INVALID_CREDENTIALS" | "PENDING";

export type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export type MetaPage = {
  id: string;
  name: string;
  access_token: string;
};

export type MetaInstagramAccount = {
  id: string;
  username: string;
};

export type MetaOAuthState = {
  tenantId?: string | null;
  saasId?: string | null;
  redirectTo?: string | null;
  format?: "json" | "base64url-json" | "base64-json" | "compact";
};

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class MetaIntegrationError extends Error {
  code: string;
  accountStatus: MetaErrorStatus;
  details: Record<string, unknown> | null;

  constructor(
    message: string,
    opts: { code: string; accountStatus: MetaErrorStatus; details?: Record<string, unknown> | null },
  ) {
    super(message);
    this.code = opts.code;
    this.accountStatus = opts.accountStatus;
    this.details = opts.details ?? null;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const META_BASE_URL_ENV_KEYS: MetaEnvKey[] = [
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "BASE_URL",
  "SITE_URL",
  "NEXTAUTH_URL",
  "CF_PAGES_URL",
];

function toMetaRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function decodeMetaState(value: string, encoding: "base64url" | "base64"): string | null {
  try {
    return Buffer.from(value, encoding).toString("utf8");
  } catch {
    return null;
  }
}

function normalizeMetaOAuthStatePayload(payload: Record<string, unknown>, format: MetaOAuthState["format"]): MetaOAuthState | null {
  const tenantId = typeof payload.tenantId === "string" && payload.tenantId.trim() ? payload.tenantId.trim() : null;
  const saasId = typeof payload.saasId === "string" && payload.saasId.trim() ? payload.saasId.trim() : null;
  const redirectTo = typeof payload.redirectTo === "string" && payload.redirectTo.trim() ? payload.redirectTo.trim() : null;

  if (!tenantId && !saasId && !redirectTo) {
    return null;
  }

  return {
    tenantId,
    saasId,
    redirectTo,
    format,
  };
}

async function parseMetaJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const payload = await response.json();
    return toMetaRecord(payload);
  } catch {
    return null;
  }
}

function normalizeMetaApiMessage(payload: Record<string, unknown> | null, fallback: string): string {
  const error = toMetaRecord(payload?.error);
  const message = typeof error?.message === "string" ? error.message : null;
  return message?.trim() || fallback;
}

function buildMetaApiError(
  code: string,
  message: string,
  options?: {
    status?: number;
    payload?: Record<string, unknown> | null;
    accountStatus?: MetaErrorStatus;
  },
): MetaIntegrationError {
  return new MetaIntegrationError(message, {
    code,
    accountStatus: options?.accountStatus ?? "PENDING",
    details: {
      ...(typeof options?.status === "number" ? { status: options.status } : {}),
      ...(options?.payload ?? {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Environment resolution
// ---------------------------------------------------------------------------

export function resolveMetaEnvValue(key: MetaEnvKey): MetaResolvedValue | null {
  const processValue = process.env[key];
  if (typeof processValue === "string" && processValue.trim()) {
    return { value: processValue.trim(), source: `process.env.${key}` };
  }

  const bindings = env() as Record<string, unknown> | null;
  const bindingValue = bindings?.[key];
  if (typeof bindingValue === "string" && bindingValue.trim()) {
    return { value: bindingValue.trim(), source: `cloudflare.env.${key}` };
  }

  return null;
}

export function getMetaAppIdWithSource(): MetaResolvedValue {
  const resolved = resolveMetaEnvValue("META_APP_ID");
  if (resolved) return resolved;
  throw new MetaIntegrationError("META_APP_ID is not configured.", {
    code: "META_ENV_MISSING",
    accountStatus: "PENDING",
    details: { key: "META_APP_ID", attemptedSources: ["process.env", "cloudflare.env"] },
  });
}

export function getMetaAppSecretWithSource(): MetaResolvedValue {
  const resolved = resolveMetaEnvValue("META_APP_SECRET");
  if (resolved) return resolved;
  throw new MetaIntegrationError("META_APP_SECRET is not configured.", {
    code: "META_ENV_MISSING",
    accountStatus: "PENDING",
    details: { key: "META_APP_SECRET", attemptedSources: ["process.env", "cloudflare.env"] },
  });
}

// ---------------------------------------------------------------------------
// Origin & callback resolution
// ---------------------------------------------------------------------------

function normalizeOrigin(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch {
    return null;
  }
}

function classifyMetaRuntime(origin: string): MetaRuntimeKind {
  const url = new URL(origin);
  const hostname = url.hostname.toLowerCase();
  const port = url.port;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    if (port === "8787") return "worker-local";
    if (port === "3000") return "next-dev-local";
    return "local";
  }

  if (hostname.endsWith(".workers.dev")) {
    return "worker";
  }

  return "production";
}

function resolveRequestOrigin(request?: Request): MetaResolvedValue | null {
  if (!request) return null;

  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  if (forwardedHost) {
    const inferredProto = forwardedProto || (forwardedHost.includes("localhost") || forwardedHost.startsWith("127.0.0.1") ? "http" : "https");
    const origin = normalizeOrigin(`${inferredProto}://${forwardedHost}`);
    if (origin) {
      return { value: origin, source: forwardedProto ? "request.forwarded" : "request.forwarded_host" };
    }
  }

  const originHeader = request.headers.get("origin");
  if (originHeader) {
    const origin = normalizeOrigin(originHeader);
    if (origin) {
      return { value: origin, source: "request.origin_header" };
    }
  }

  try {
    const url = new URL(request.url);
    return { value: url.origin, source: "request.url" };
  } catch {
    return null;
  }
}

function normalizeMetaCallbackPath(callbackPath?: string): string {
  const normalizedPath = callbackPath?.trim() || META_CALLBACK_PATH;
  if (normalizedPath.startsWith("/")) {
    return normalizedPath;
  }
  return `/${normalizedPath}`;
}

// ---------------------------------------------------------------------------
// Public API — Callback & diagnostics resolution
// ---------------------------------------------------------------------------

export function resolveMetaCallback(request?: Request, options?: MetaCallbackOptions): MetaCallbackResolution {
  const callbackPath = normalizeMetaCallbackPath(options?.callbackPath);
  const requestOrigin = resolveRequestOrigin(request);
  if (requestOrigin) {
    return {
      callbackUrl: `${requestOrigin.value}${callbackPath}`,
      origin: requestOrigin.value,
      originSource: requestOrigin.source,
      runtime: classifyMetaRuntime(requestOrigin.value),
    };
  }

  for (const key of META_BASE_URL_ENV_KEYS) {
    const resolved = resolveMetaEnvValue(key);
    const origin = resolved ? normalizeOrigin(resolved.value) : null;
    if (resolved && origin) {
      return {
        callbackUrl: `${origin}${callbackPath}`,
        origin,
        originSource: resolved.source,
        runtime: classifyMetaRuntime(origin),
      };
    }
  }

  const fallbackOrigin = "http://localhost:3000";
  return {
    callbackUrl: `${fallbackOrigin}${callbackPath}`,
    origin: fallbackOrigin,
    originSource: "default.localhost:3000",
    runtime: "next-dev-local",
  };
}

export function resolveMetaOAuthDiagnostics(request?: Request, options?: MetaCallbackOptions): MetaOAuthDiagnostics {
  const callback = resolveMetaCallback(request, options);
  const appId = getMetaAppIdWithSource();
  return {
    ...callback,
    appId: appId.value,
    appIdSource: appId.source,
  };
}

// ---------------------------------------------------------------------------
// Public API — State parsing
// ---------------------------------------------------------------------------

export function parseMetaOAuthState(rawState: string | null | undefined): MetaOAuthState | null {
  const normalizedState = rawState?.trim();
  if (!normalizedState) return null;

  if (normalizedState.startsWith("{")) {
    try {
      const parsed = JSON.parse(normalizedState) as unknown;
      const payload = toMetaRecord(parsed);
      return payload ? normalizeMetaOAuthStatePayload(payload, "json") : null;
    } catch {
      return null;
    }
  }

  const base64UrlDecoded = decodeMetaState(normalizedState, "base64url");
  if (base64UrlDecoded?.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(base64UrlDecoded) as unknown;
      const payload = toMetaRecord(parsed);
      return payload ? normalizeMetaOAuthStatePayload(payload, "base64url-json") : null;
    } catch {
      return null;
    }
  }

  const base64Decoded = decodeMetaState(normalizedState, "base64");
  if (base64Decoded?.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(base64Decoded) as unknown;
      const payload = toMetaRecord(parsed);
      return payload ? normalizeMetaOAuthStatePayload(payload, "base64-json") : null;
    } catch {
      return null;
    }
  }

  const compactState = normalizedState.split("__");
  if (compactState.length >= 2) {
    const tenantId = compactState[0]?.trim() || null;
    const saasId = compactState[1]?.trim() || null;
    if (tenantId || saasId) {
      return {
        tenantId,
        saasId,
        redirectTo: null,
        format: "compact",
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API — Token exchange
// ---------------------------------------------------------------------------

export async function exchangeMetaCodeForAccessToken(
  code: string,
  request?: Request,
  options?: MetaCallbackOptions,
): Promise<MetaTokenResponse> {
  const normalizedCode = code.trim();
  if (!normalizedCode) {
    throw buildMetaApiError("META_CODE_MISSING", "Meta authorization code is required.", { accountStatus: "PENDING" });
  }

  const callback = resolveMetaCallback(request, options);
  const appId = getMetaAppIdWithSource();
  const appSecret = getMetaAppSecretWithSource();

  const shortLivedUrl = new URL(`${META_GRAPH_BASE_URL}/oauth/access_token`);
  shortLivedUrl.searchParams.set("client_id", appId.value);
  shortLivedUrl.searchParams.set("client_secret", appSecret.value);
  shortLivedUrl.searchParams.set("redirect_uri", callback.callbackUrl);
  shortLivedUrl.searchParams.set("code", normalizedCode);

  const shortLivedResponse = await fetch(shortLivedUrl.toString(), { method: "GET", cache: "no-store" });
  const shortLivedPayload = await parseMetaJson(shortLivedResponse);
  if (!shortLivedResponse.ok) {
    throw buildMetaApiError(
      "META_TOKEN_EXCHANGE_FAILED",
      normalizeMetaApiMessage(shortLivedPayload, "Meta token exchange failed."),
      {
        status: shortLivedResponse.status,
        payload: {
          redirectUri: callback.callbackUrl,
          redirectSource: callback.originSource,
          appIdSource: appId.source,
          appSecretSource: appSecret.source,
          ...(shortLivedPayload ?? {}),
        },
        accountStatus: shortLivedResponse.status === 401 ? "INVALID_CREDENTIALS" : "PENDING",
      },
    );
  }

  if (typeof shortLivedPayload?.access_token !== "string" || !shortLivedPayload.access_token.trim()) {
    throw buildMetaApiError("META_TOKEN_MISSING", "Meta token exchange did not return an access token.", {
      status: shortLivedResponse.status,
      payload: shortLivedPayload,
      accountStatus: "PENDING",
    });
  }

  const longLivedUrl = new URL(`${META_GRAPH_BASE_URL}/oauth/access_token`);
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  longLivedUrl.searchParams.set("client_id", appId.value);
  longLivedUrl.searchParams.set("client_secret", appSecret.value);
  longLivedUrl.searchParams.set("fb_exchange_token", shortLivedPayload.access_token.trim());

  const longLivedResponse = await fetch(longLivedUrl.toString(), { method: "GET", cache: "no-store" });
  const longLivedPayload = await parseMetaJson(longLivedResponse);
  if (!longLivedResponse.ok || typeof longLivedPayload?.access_token !== "string" || !longLivedPayload.access_token.trim()) {
    throw buildMetaApiError(
      "META_LONG_LIVED_TOKEN_EXCHANGE_FAILED",
      normalizeMetaApiMessage(longLivedPayload, "Meta long-lived token exchange failed."),
      {
        status: longLivedResponse.status,
        payload: longLivedPayload,
        accountStatus: longLivedResponse.status === 401 ? "INVALID_CREDENTIALS" : "PENDING",
      },
    );
  }

  return {
    access_token: longLivedPayload.access_token.trim(),
    token_type: typeof longLivedPayload.token_type === "string" ? longLivedPayload.token_type : undefined,
    expires_in: typeof longLivedPayload.expires_in === "number" ? longLivedPayload.expires_in : undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API — Pages & Instagram Business Account
// ---------------------------------------------------------------------------

export async function fetchMetaPages(accessToken: string): Promise<MetaPage[]> {
  const normalizedToken = accessToken.trim();
  if (!normalizedToken) {
    throw buildMetaApiError("META_ACCESS_TOKEN_MISSING", "Meta access token is required.", { accountStatus: "INVALID_CREDENTIALS" });
  }

  const url = new URL(`${META_GRAPH_BASE_URL}/me/accounts`);
  url.searchParams.set("access_token", normalizedToken);
  url.searchParams.set("fields", "id,name,access_token");

  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const payload = await parseMetaJson(response);
  if (!response.ok) {
    throw buildMetaApiError("META_PAGES_FETCH_FAILED", normalizeMetaApiMessage(payload, "Meta Pages lookup failed."), {
      status: response.status,
      payload,
    });
  }

  const data = Array.isArray(payload?.data) ? payload.data : [];
  return data.flatMap((entry) => {
    const record = toMetaRecord(entry);
    if (
      !record
      || typeof record.id !== "string"
      || typeof record.name !== "string"
      || typeof record.access_token !== "string"
    ) {
      return [];
    }
    return [{ id: record.id, name: record.name, access_token: record.access_token }];
  });
}

// ---------------------------------------------------------------------------
// Public API — Instagram Insights
// ---------------------------------------------------------------------------

export type InstagramAccountInsights = {
  followersCount: number;
  impressions: number;
  reach: number;
  capturedAt: string;
};

export type InstagramMediaItem = {
  id: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
};

export type InstagramMediaInsights = {
  impressions: number;
  reach: number;
  saved: number;
  shares: number;
  // Solo presentes cuando isReel=true — video_views/plays/ig_reels_avg_watch_time no son
  // métricas válidas para foto/carrusel, la Insights API rechaza la petición entera si se
  // piden fuera de un Reel. undefined (no 0) para no fingir un dato que no se pidió.
  videoViews?: number;
  plays?: number;
  avgWatchTimeMs?: number;
};

function sumInsightMetric(data: unknown[], metricName: string): number {
  if (!Array.isArray(data)) return 0;
  const metric = data.find((d) => toMetaRecord(d)?.name === metricName);
  const values = toMetaRecord(metric)?.values;
  if (!Array.isArray(values)) return 0;
  return values.reduce((sum, v) => {
    const val = toMetaRecord(v)?.value;
    return sum + (typeof val === "number" ? val : 0);
  }, 0);
}

export async function fetchInstagramAccountInsights(
  pageToken: string,
  igUserId: string,
  apiBase: string,
): Promise<InstagramAccountInsights> {
  const normalizedToken = pageToken.trim();
  const normalizedId = igUserId.trim();
  if (!normalizedToken || !normalizedId) {
    throw buildMetaApiError("META_ACCESS_TOKEN_MISSING", "Page token and IG user ID are required.", { accountStatus: "INVALID_CREDENTIALS" });
  }

  const since = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const until = Math.floor(Date.now() / 1000);

  const [insightsResponse, profileResponse] = await Promise.all([
    fetch(
      `${apiBase}/${normalizedId}/insights?metric=impressions,reach&period=day&since=${since}&until=${until}&access_token=${normalizedToken}`,
      { method: "GET", cache: "no-store" },
    ),
    fetch(
      `${apiBase}/${normalizedId}?fields=followers_count&access_token=${normalizedToken}`,
      { method: "GET", cache: "no-store" },
    ),
  ]);

  const insightsPayload = await parseMetaJson(insightsResponse);
  const profilePayload = await parseMetaJson(profileResponse);

  const data = Array.isArray(insightsPayload?.data) ? insightsPayload.data : [];
  const followersCount = typeof profilePayload?.followers_count === "number" ? profilePayload.followers_count : 0;

  return {
    followersCount,
    impressions: sumInsightMetric(data, "impressions"),
    reach: sumInsightMetric(data, "reach"),
    capturedAt: new Date().toISOString(),
  };
}

export async function fetchInstagramRecentMedia(
  pageToken: string,
  igUserId: string,
  apiBase: string,
): Promise<InstagramMediaItem[]> {
  const normalizedToken = pageToken.trim();
  const normalizedId = igUserId.trim();
  if (!normalizedToken || !normalizedId) {
    throw buildMetaApiError("META_ACCESS_TOKEN_MISSING", "Page token and IG user ID are required.", { accountStatus: "INVALID_CREDENTIALS" });
  }

  const url = new URL(`${apiBase}/${normalizedId}/media`);
  url.searchParams.set("fields", "id,timestamp,like_count,comments_count");
  url.searchParams.set("limit", "25");
  url.searchParams.set("access_token", normalizedToken);

  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const payload = await parseMetaJson(response);
  if (!response.ok) {
    throw buildMetaApiError("META_MEDIA_FETCH_FAILED", normalizeMetaApiMessage(payload, "Instagram media fetch failed."), { status: response.status, payload });
  }

  const data = Array.isArray(payload?.data) ? payload.data : [];
  return data.flatMap((entry) => {
    const record = toMetaRecord(entry);
    if (!record || typeof record.id !== "string" || typeof record.timestamp !== "string") return [];
    return [{
      id: record.id,
      timestamp: record.timestamp,
      likeCount: typeof record.like_count === "number" ? record.like_count : 0,
      commentsCount: typeof record.comments_count === "number" ? record.comments_count : 0,
    }];
  });
}

// isReel selects which metric set to request — the Insights API rejects the ENTIRE
// request with a 400 if any metric in the list doesn't apply to that media's type
// (video_views/plays/ig_reels_avg_watch_time only exist for Reels; impressions is
// deprecated for Reels), so the two sets can never be concatenated into one call.
export async function fetchInstagramMediaInsights(
  pageToken: string,
  mediaId: string,
  apiBase: string,
  isReel: boolean,
): Promise<InstagramMediaInsights> {
  const normalizedToken = pageToken.trim();
  const normalizedMediaId = mediaId.trim();
  if (!normalizedToken || !normalizedMediaId) {
    throw buildMetaApiError("META_ACCESS_TOKEN_MISSING", "Page token and media ID are required.", { accountStatus: "INVALID_CREDENTIALS" });
  }

  const metric = isReel
    ? "reach,saved,shares,video_views,plays,ig_reels_avg_watch_time"
    : "impressions,reach,saved,shares";

  const url = new URL(`${apiBase}/${normalizedMediaId}/insights`);
  url.searchParams.set("metric", metric);
  url.searchParams.set("access_token", normalizedToken);

  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const payload = await parseMetaJson(response);
  if (!response.ok) {
    throw buildMetaApiError("META_MEDIA_INSIGHTS_FAILED", normalizeMetaApiMessage(payload, "Instagram media insights fetch failed."), { status: response.status, payload });
  }

  const data = Array.isArray(payload?.data) ? payload.data : [];
  return {
    impressions: isReel ? 0 : sumInsightMetric(data, "impressions"),
    reach: sumInsightMetric(data, "reach"),
    saved: sumInsightMetric(data, "saved"),
    shares: sumInsightMetric(data, "shares"),
    ...(isReel
      ? {
          videoViews: sumInsightMetric(data, "video_views"),
          plays: sumInsightMetric(data, "plays"),
          avgWatchTimeMs: sumInsightMetric(data, "ig_reels_avg_watch_time"),
        }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API — Pages & Instagram Business Account
// ---------------------------------------------------------------------------

export async function fetchInstagramBusinessAccount(pageId: string, pageAccessToken: string): Promise<MetaInstagramAccount | null> {
  const normalizedPageId = pageId.trim();
  const normalizedToken = pageAccessToken.trim();
  if (!normalizedPageId || !normalizedToken) {
    throw buildMetaApiError("META_ACCESS_TOKEN_MISSING", "Meta page id and access token are required.", { accountStatus: "INVALID_CREDENTIALS" });
  }

  const url = new URL(`${META_GRAPH_BASE_URL}/${normalizedPageId}`);
  url.searchParams.set("fields", "instagram_business_account{id,username}");
  url.searchParams.set("access_token", normalizedToken);

  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const payload = await parseMetaJson(response);
  if (!response.ok) {
    throw buildMetaApiError("META_INSTAGRAM_LOOKUP_FAILED", normalizeMetaApiMessage(payload, "Instagram Business Account lookup failed."), {
      status: response.status,
      payload,
    });
  }

  const account = toMetaRecord(payload?.instagram_business_account);
  if (!account || typeof account.id !== "string" || typeof account.username !== "string") {
    return null;
  }
  return { id: account.id, username: account.username };
}
