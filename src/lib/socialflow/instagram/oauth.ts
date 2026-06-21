import { env } from "@/lib/cf";
import { encryptToken } from "@/lib/socialflow/token-encryption";
import { listSaasSocialAccounts, resolveSocialContext, upsertSaasSocialAccount } from "@/lib/socialflow/repository";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INSTAGRAM_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_LONG_LIVED_URL = "https://graph.instagram.com/access_token";
const INSTAGRAM_GRAPH_ME_URL = "https://graph.instagram.com/me";

export const INSTAGRAM_OAUTH_CALLBACK_PATH = "/api/socialflow/oauth/instagram/callback";
export const INSTAGRAM_OAUTH_SCOPES =
  "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights";

const SETTINGS_REDIRECT = "/socialflow/settings/accounts";

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class InstagramOAuthError extends Error {
  code: string;
  details: Record<string, unknown> | null;

  constructor(message: string, opts: { code: string; details?: Record<string, unknown> | null }) {
    super(message);
    this.name = "InstagramOAuthError";
    this.code = opts.code;
    this.details = opts.details ?? null;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InstagramOAuthState = {
  tenantId: string;
  saasId: string;
  redirectTo: string;
  callbackUrl: string;
};

export type InstagramTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type InstagramUser = {
  id: string;
  username: string;
  account_type?: string;
};

// ---------------------------------------------------------------------------
// Environment resolution
// ---------------------------------------------------------------------------

function readEnvString(key: string): string | null {
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  if (typeof fromProcess === "string" && fromProcess.trim()) return fromProcess.trim();
  const bindings = env() as Record<string, unknown> | null;
  const fromBindings = bindings?.[key];
  if (typeof fromBindings === "string" && fromBindings.trim()) return fromBindings.trim();
  return null;
}

export function getInstagramAppId(): string {
  const id = readEnvString("INSTAGRAM_APP_ID");
  if (!id) {
    throw new InstagramOAuthError("INSTAGRAM_APP_ID is not configured.", {
      code: "INSTAGRAM_ENV_MISSING",
      details: { key: "INSTAGRAM_APP_ID" },
    });
  }
  return id;
}

export function getInstagramAppSecret(): string {
  // META_APP_SECRET is the shared secret for the Instagram app
  const secret = readEnvString("META_APP_SECRET");
  if (!secret) {
    throw new InstagramOAuthError("META_APP_SECRET is not configured.", {
      code: "INSTAGRAM_ENV_MISSING",
      details: { key: "META_APP_SECRET" },
    });
  }
  return secret;
}

// ---------------------------------------------------------------------------
// Callback URL resolution
// ---------------------------------------------------------------------------

// APP_URL is the authoritative source — avoids redirect_uri mismatches when
// x-forwarded-host carries a different domain (e.g. info.drako.systems) and
// the registered URI in Meta is socialflows.drako.systems.
export function resolveInstagramCallbackUrl(request: Request): string {
  const appUrl = readEnvString("APP_URL");
  if (appUrl) {
    try {
      const { origin } = new URL(appUrl);
      return `${origin}${INSTAGRAM_OAUTH_CALLBACK_PATH}`;
    } catch { /* fall through */ }
  }

  // Fallback: derive from request (only reliable in local dev)
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  if (forwardedHost) {
    const proto = forwardedProto || (forwardedHost.startsWith("localhost") ? "http" : "https");
    return `${proto}://${forwardedHost}${INSTAGRAM_OAUTH_CALLBACK_PATH}`;
  }

  try {
    const { origin } = new URL(request.url);
    return `${origin}${INSTAGRAM_OAUTH_CALLBACK_PATH}`;
  } catch {
    return `https://socialflows.drako.systems${INSTAGRAM_OAUTH_CALLBACK_PATH}`;
  }
}

// ---------------------------------------------------------------------------
// State encoding / decoding
// ---------------------------------------------------------------------------

function encodeState(state: InstagramOAuthState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function parseInstagramOAuthState(raw: string | null | undefined): InstagramOAuthState | null {
  if (!raw?.trim()) return null;
  try {
    const decoded = Buffer.from(raw.trim(), "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    const tenantId = typeof parsed.tenantId === "string" ? parsed.tenantId.trim() : "";
    const saasId = typeof parsed.saasId === "string" ? parsed.saasId.trim() : "";
    const redirectTo = typeof parsed.redirectTo === "string" ? parsed.redirectTo.trim() : SETTINGS_REDIRECT;
    const callbackUrl = typeof parsed.callbackUrl === "string" ? parsed.callbackUrl.trim() : "";
    if (!tenantId || !saasId) return null;
    return { tenantId, saasId, redirectTo: redirectTo || SETTINGS_REDIRECT, callbackUrl };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Authorization URL builder
// ---------------------------------------------------------------------------

export function buildInstagramAuthorizationUrl(input: {
  request: Request;
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
}): { authorizationUrl: string; callbackUrl: string; state: string } {
  const appId = getInstagramAppId();
  const callbackUrl = resolveInstagramCallbackUrl(input.request);
  const state = encodeState({
    tenantId: input.tenantId,
    saasId: input.saasId,
    redirectTo: input.redirectTo?.trim() || `${SETTINGS_REDIRECT}?saasId=${encodeURIComponent(input.saasId)}`,
    callbackUrl,
  });
  console.log("INSTAGRAM_BUILD_AUTH_URL", { appId, callbackUrl });

  const url = new URL(INSTAGRAM_AUTHORIZE_URL);
  url.searchParams.set("force_reauth", "true");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_OAUTH_SCOPES);
  url.searchParams.set("state", state);

  return { authorizationUrl: url.toString(), callbackUrl, state };
}

// ---------------------------------------------------------------------------
// Token exchange helpers
// ---------------------------------------------------------------------------

async function parseJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const body = await res.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function apiErrorMessage(payload: Record<string, unknown> | null, fallback: string): string {
  const raw = payload?.error_message ?? payload?.error;
  const msg = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>).message : raw;
  if (typeof msg === "string" && msg.trim()) return msg.trim();
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return fallback;
}

export async function exchangeInstagramCode(input: {
  code: string;
  callbackUrl: string;
}): Promise<InstagramTokenResponse> {
  const appId = getInstagramAppId();
  const appSecret = getInstagramAppSecret();

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: input.callbackUrl,
    code: input.code.trim(),
  });

  console.log("INSTAGRAM_TOKEN_EXCHANGE_REQUEST", {
    url: INSTAGRAM_TOKEN_URL,
    client_id: appId,
    redirect_uri: input.callbackUrl,
    code_length: input.code.trim().length,
  });

  const res = await fetch(INSTAGRAM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  });

  const rawBody = await res.text();
  let payload: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      payload = parsed as Record<string, unknown>;
    }
  } catch { /* not JSON */ }

  console.log("INSTAGRAM_TOKEN_EXCHANGE_RESPONSE", {
    status: res.status,
    ok: res.ok,
    rawBody,
    payload,
  });

  if (!res.ok || typeof payload?.access_token !== "string") {
    throw new InstagramOAuthError(
      apiErrorMessage(payload, "Instagram short-lived token exchange failed."),
      { code: "INSTAGRAM_TOKEN_EXCHANGE_FAILED", details: { status: res.status, rawBody, ...(payload ?? {}) } },
    );
  }

  return {
    access_token: (payload.access_token as string).trim(),
    token_type: typeof payload.token_type === "string" ? payload.token_type : "bearer",
    expires_in: typeof payload.expires_in === "number" ? payload.expires_in : 3600,
  };
}

export async function exchangeForLongLivedInstagramToken(shortLivedToken: string): Promise<InstagramTokenResponse> {
  const appId = getInstagramAppId();
  const appSecret = getInstagramAppSecret();

  const url = new URL(INSTAGRAM_LONG_LIVED_URL);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortLivedToken);

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const payload = await parseJson(res);

  if (!res.ok || typeof payload?.access_token !== "string") {
    throw new InstagramOAuthError(
      apiErrorMessage(payload, "Instagram long-lived token exchange failed."),
      { code: "INSTAGRAM_LONG_LIVED_TOKEN_FAILED", details: { status: res.status, ...(payload ?? {}) } },
    );
  }

  return {
    access_token: payload.access_token.trim(),
    token_type: typeof payload.token_type === "string" ? payload.token_type : "bearer",
    expires_in: typeof payload.expires_in === "number" ? payload.expires_in : 5184000, // 60 days
  };
}

export async function fetchInstagramUser(accessToken: string): Promise<InstagramUser> {
  const url = new URL(INSTAGRAM_GRAPH_ME_URL);
  url.searchParams.set("fields", "id,username,account_type");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const payload = await parseJson(res);

  if (!res.ok || typeof payload?.id !== "string" || typeof payload?.username !== "string") {
    throw new InstagramOAuthError(
      apiErrorMessage(payload, "Failed to fetch Instagram user info."),
      { code: "INSTAGRAM_USER_FETCH_FAILED", details: { status: res.status, ...(payload ?? {}) } },
    );
  }

  return {
    id: payload.id.trim(),
    username: payload.username.trim(),
    account_type: typeof payload.account_type === "string" ? payload.account_type : undefined,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function persistInstagramOAuthConnection(input: {
  tenantId: string;
  saasId: string;
  token: InstagramTokenResponse;
  user: InstagramUser;
}): Promise<{ status: "persisted" | "updated"; accountId: string }> {
  const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
  const existing = await listSaasSocialAccounts(ctx);
  const existingIg = existing.find(
    (a) => a.provider === "INSTAGRAM" && (a.authMeta as Record<string, unknown>)?.authType === "instagram_business_login",
  ) ?? existing.find((a) => a.provider === "INSTAGRAM");

  const encryptedToken = await encryptToken(input.token.access_token);
  const expiresAt = new Date(Date.now() + input.token.expires_in * 1000).toISOString();

  const account = await upsertSaasSocialAccount(ctx, {
    id: existingIg?.id,
    saasId: input.saasId,
    provider: "INSTAGRAM",
    handle: input.user.username,
    displayName: input.user.username,
    status: "CONNECTED_REAL",
    authMeta: {
      authType: "instagram_business_login",
      mode: "live",
      provider: "INSTAGRAM",
      accessToken: encryptedToken,
      igUserId: input.user.id,
      username: input.user.username,
      accountType: input.user.account_type ?? null,
      tokenType: input.token.token_type,
      expiresIn: input.token.expires_in,
      expiresAt,
    },
    isPrimary: existingIg?.isPrimary ?? !existing.some((a) => a.provider === "INSTAGRAM"),
  });

  return { status: existingIg ? "updated" : "persisted", accountId: account.id };
}
