/**
 * Canonical LinkedIn API primitives for SocialFlow.
 *
 * This module is the single source of truth for LinkedIn OAuth types,
 * error handling, environment resolution, callback resolution, state
 * parsing, token exchange, profile fetching, identity resolution,
 * publishing, and diagnostics.
 *
 * Legacy consumers should import via the deprecated compatibility
 * facade at `@/lib/social/linkedin`.
 */
import { env } from "@/lib/cf";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LINKEDIN_TOKEN_ENDPOINT = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_ENDPOINT = "https://api.linkedin.com/v2/userinfo";
const LINKEDIN_ORGANIZATION_ACLS_ENDPOINT = "https://api.linkedin.com/v2/organizationAcls";
const LINKEDIN_CALLBACK_PATH = "/auth/linkedin/callback";
const LINKEDIN_ORGANIZATION_SCOPE_ENV_KEY = "SOCIALFLOW_LINKEDIN_ORGANIZATION_SCOPE_ENABLED";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LinkedInCallbackOptions = {
  callbackPath?: string;
};

export type LinkedInEnvKey =
  | "LINKEDIN_CLIENT_ID"
  | "LINKEDIN_CLIENT_SECRET"
  | "APP_URL"
  | "NEXT_PUBLIC_APP_URL"
  | "BASE_URL"
  | "SITE_URL"
  | "NEXTAUTH_URL"
  | "CF_PAGES_URL";

type LinkedInResolvedValue = {
  value: string;
  source: string;
};

export type LinkedInRuntimeKind =
  | "worker-local"
  | "next-dev-local"
  | "local"
  | "worker"
  | "production";

export type LinkedInCallbackResolution = {
  callbackUrl: string;
  origin: string;
  originSource: string;
  runtime: LinkedInRuntimeKind;
};

export type LinkedInOAuthDiagnostics = LinkedInCallbackResolution & {
  clientId: string;
  clientIdSource: string;
  clientSecretSource?: string;
  pkceUsed: false;
};

export type LinkedInErrorStatus = "INVALID_CREDENTIALS" | "PENDING";

export type LinkedInTokenResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

export type LinkedInUserProfile = {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  email?: string;
  email_verified?: boolean;
};

export type LinkedInResolvedIdentity = {
  profileId: string;
  authorUrn: string;
  displayName: string;
  email: string | null;
  emailVerified: boolean | null;
  picture: string | null;
  locale: string | null;
};

export type LinkedInPublishPostInput = {
  accessToken: string;
  authorUrn: string;
  content: string;
};

export type LinkedInPublishOrganizationPostInput = {
  accessToken: string;
  organizationUrn: string;
  content: string;
};

export type LinkedInPublishPostResult = {
  externalPostId: string | null;
  linkedinStatus: number;
  body: Record<string, unknown> | null;
};

export type LinkedInOrganizationAcl = {
  organizationUrn: string;
  organizationId: string;
  role: string;
  state: string;
};

export type LinkedInResolvedOrganization = {
  organizationUrn: string;
  organizationId: string;
  name: string | null;
};

export type LinkedInOAuthState = {
  tenantId?: string | null;
  saasId?: string | null;
  redirectTo?: string | null;
  format?: "json" | "base64url-json" | "base64-json" | "compact";
};

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class LinkedInIntegrationError extends Error {
  code: string;
  accountStatus: LinkedInErrorStatus;
  details: Record<string, unknown> | null;

  constructor(
    message: string,
    opts: { code: string; accountStatus: LinkedInErrorStatus; details?: Record<string, unknown> | null },
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

const LINKEDIN_BASE_URL_ENV_KEYS: LinkedInEnvKey[] = [
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "BASE_URL",
  "SITE_URL",
  "NEXTAUTH_URL",
  "CF_PAGES_URL",
];

function toLinkedInRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function decodeLinkedInState(value: string, encoding: "base64url" | "base64"): string | null {
  try {
    return Buffer.from(value, encoding).toString("utf8");
  } catch {
    return null;
  }
}

function normalizeLinkedInOAuthStatePayload(payload: Record<string, unknown>, format: LinkedInOAuthState["format"]): LinkedInOAuthState | null {
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

async function parseLinkedInJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const payload = await response.json();
    return toLinkedInRecord(payload);
  } catch {
    return null;
  }
}

async function parseLinkedInResponseBody(response: Response): Promise<Record<string, unknown> | null> {
  const payload = await parseLinkedInJson(response);
  if (payload) return payload;

  try {
    const text = await response.text();
    if (!text.trim()) return null;
    return { message: text };
  } catch {
    return null;
  }
}

function normalizeLinkedInApiMessage(payload: Record<string, unknown> | null, fallback: string): string {
  const message =
    typeof payload?.message === "string" ? payload.message
    : typeof payload?.error_description === "string" ? payload.error_description
    : typeof payload?.error === "string" ? payload.error
    : null;

  return message?.trim() || fallback;
}

function inferTokenExchangeFailureReason(payload: Record<string, unknown> | null, status: number): string {
  const description = `${typeof payload?.error === "string" ? payload.error : ""} ${typeof payload?.error_description === "string" ? payload.error_description : ""}`
    .toLowerCase()
    .trim();

  if (description.includes("caduc") || description.includes("expired")) {
    return "authorization_code_expired";
  }
  if (description.includes("already used") || description.includes("reused")) {
    return "authorization_code_reused";
  }
  if (description.includes("redirect") || description.includes("no coincide") || description.includes("does not match")) {
    return "redirect_uri_mismatch";
  }
  if (status === 401) {
    return "authorization_code_expired_or_reused_or_redirect_mismatch";
  }
  return "token_exchange_failed";
}

function isAuthorizationCodeMismatchError(payload: Record<string, unknown> | null): boolean {
  const description = `${typeof payload?.error === "string" ? payload.error : ""} ${typeof payload?.error_description === "string" ? payload.error_description : ""}`
    .toLowerCase()
    .trim();

  return (
    description.includes("authorization code")
    || description.includes("código de autorización")
    || description.includes("code")
  );
}

function buildLinkedInApiError(
  code: string,
  message: string,
  options?: {
    status?: number;
    payload?: Record<string, unknown> | null;
    accountStatus?: LinkedInErrorStatus;
  },
): LinkedInIntegrationError {
  return new LinkedInIntegrationError(message, {
    code,
    accountStatus: options?.accountStatus ?? "PENDING",
    details: {
      ...(typeof options?.status === "number" ? { status: options.status } : {}),
      ...(options?.payload ?? {}),
    },
  });
}

function resolveLinkedInDisplayName(profile: LinkedInUserProfile): string {
  const explicitName = typeof profile.name === "string" ? profile.name.trim() : "";
  if (explicitName) return explicitName;

  const fullName = [profile.given_name, profile.family_name]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())
    .join(" ")
    .trim();
  if (fullName) return fullName;

  if (typeof profile.given_name === "string" && profile.given_name.trim()) return profile.given_name.trim();
  if (typeof profile.family_name === "string" && profile.family_name.trim()) return profile.family_name.trim();
  return profile.sub;
}

// ---------------------------------------------------------------------------
// Environment resolution
// ---------------------------------------------------------------------------

function resolveLinkedInEnvValue(key: LinkedInEnvKey): LinkedInResolvedValue | null {
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

function getEnvString(key: "LINKEDIN_CLIENT_ID" | "LINKEDIN_CLIENT_SECRET"): string {
  const resolved = resolveLinkedInEnvValue(key);
  if (resolved) {
    return resolved.value;
  }
  throw new LinkedInIntegrationError(`${key} is not configured.`, {
    code: "LINKEDIN_ENV_MISSING",
    accountStatus: "PENDING",
    details: { key, attemptedSources: ["process.env", "cloudflare.env"] },
  });
}

function getLinkedInClientIdWithSource(): LinkedInResolvedValue {
  const resolved = resolveLinkedInEnvValue("LINKEDIN_CLIENT_ID");
  if (resolved) return resolved;
  throw new LinkedInIntegrationError("LINKEDIN_CLIENT_ID is not configured.", {
    code: "LINKEDIN_ENV_MISSING",
    accountStatus: "PENDING",
    details: { key: "LINKEDIN_CLIENT_ID", attemptedSources: ["process.env", "cloudflare.env"] },
  });
}

function getLinkedInClientSecretWithSource(): LinkedInResolvedValue {
  const resolved = resolveLinkedInEnvValue("LINKEDIN_CLIENT_SECRET");
  if (resolved) return resolved;
  throw new LinkedInIntegrationError("LINKEDIN_CLIENT_SECRET is not configured.", {
    code: "LINKEDIN_ENV_MISSING",
    accountStatus: "PENDING",
    details: { key: "LINKEDIN_CLIENT_SECRET", attemptedSources: ["process.env", "cloudflare.env"] },
  });
}

function isTruthyLinkedInFlag(value: unknown): boolean {
  if (typeof value === "string") return ["1", "true", "on", "yes"].includes(value.trim().toLowerCase());
  if (typeof value === "boolean") return value;
  return false;
}

/**
 * Requesting `w_organization_social` without LinkedIn's Community Management API
 * approval for this client_id can make LinkedIn reject the entire consent screen,
 * including the personal-profile scopes that already work in production. Keep this
 * off until the approval is confirmed.
 */
export function isLinkedInOrganizationScopeEnabled(): boolean {
  if (isTruthyLinkedInFlag(process.env[LINKEDIN_ORGANIZATION_SCOPE_ENV_KEY])) {
    return true;
  }
  const bindings = env() as Record<string, unknown> | null;
  return isTruthyLinkedInFlag(bindings?.[LINKEDIN_ORGANIZATION_SCOPE_ENV_KEY]);
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

function classifyLinkedInRuntime(origin: string): LinkedInRuntimeKind {
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

function resolveRequestOrigin(request?: Request): LinkedInResolvedValue | null {
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

function normalizeLinkedInCallbackPath(callbackPath?: string): string {
  const normalizedPath = callbackPath?.trim() || LINKEDIN_CALLBACK_PATH;
  if (normalizedPath.startsWith("/")) {
    return normalizedPath;
  }
  return `/${normalizedPath}`;
}

// ---------------------------------------------------------------------------
// Public API — Callback & diagnostics resolution
// ---------------------------------------------------------------------------

export function resolveLinkedInCallback(request?: Request, options?: LinkedInCallbackOptions): LinkedInCallbackResolution {
  const callbackPath = normalizeLinkedInCallbackPath(options?.callbackPath);
  const requestOrigin = resolveRequestOrigin(request);
  if (requestOrigin) {
    return {
      callbackUrl: `${requestOrigin.value}${callbackPath}`,
      origin: requestOrigin.value,
      originSource: requestOrigin.source,
      runtime: classifyLinkedInRuntime(requestOrigin.value),
    };
  }

  for (const key of LINKEDIN_BASE_URL_ENV_KEYS) {
    const resolved = resolveLinkedInEnvValue(key);
    const origin = resolved ? normalizeOrigin(resolved.value) : null;
    if (resolved && origin) {
      return {
        callbackUrl: `${origin}${callbackPath}`,
        origin,
        originSource: resolved.source,
        runtime: classifyLinkedInRuntime(origin),
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

export function resolveLinkedInCallbackUrl(request?: Request, options?: LinkedInCallbackOptions): string {
  return resolveLinkedInCallback(request, options).callbackUrl;
}

export function resolveLinkedInOAuthDiagnostics(request?: Request, options?: LinkedInCallbackOptions): LinkedInOAuthDiagnostics {
  const callback = resolveLinkedInCallback(request, options);
  const clientId = getLinkedInClientIdWithSource();
  return {
    ...callback,
    clientId: clientId.value,
    clientIdSource: clientId.source,
    pkceUsed: false,
  };
}

// ---------------------------------------------------------------------------
// Public API — State parsing
// ---------------------------------------------------------------------------

export function parseLinkedInOAuthState(rawState: string | null | undefined): LinkedInOAuthState | null {
  const normalizedState = rawState?.trim();
  if (!normalizedState) return null;

  if (normalizedState.startsWith("{")) {
    try {
      const parsed = JSON.parse(normalizedState) as unknown;
      const payload = toLinkedInRecord(parsed);
      return payload ? normalizeLinkedInOAuthStatePayload(payload, "json") : null;
    } catch {
      return null;
    }
  }

  const base64UrlDecoded = decodeLinkedInState(normalizedState, "base64url");
  if (base64UrlDecoded?.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(base64UrlDecoded) as unknown;
      const payload = toLinkedInRecord(parsed);
      return payload ? normalizeLinkedInOAuthStatePayload(payload, "base64url-json") : null;
    } catch {
      return null;
    }
  }

  const base64Decoded = decodeLinkedInState(normalizedState, "base64");
  if (base64Decoded?.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(base64Decoded) as unknown;
      const payload = toLinkedInRecord(parsed);
      return payload ? normalizeLinkedInOAuthStatePayload(payload, "base64-json") : null;
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

export async function exchangeLinkedInCodeForAccessToken(
  code: string,
  request?: Request,
  options?: LinkedInCallbackOptions,
): Promise<LinkedInTokenResponse> {
  const normalizedCode = code.trim();
  if (!normalizedCode) {
    throw buildLinkedInApiError(
      "LINKEDIN_CODE_MISSING",
      "LinkedIn authorization code is required.",
      { accountStatus: "PENDING" },
    );
  }

  const callback = resolveLinkedInCallback(request, options);
  const clientId = getLinkedInClientIdWithSource();
  const clientSecret = getLinkedInClientSecretWithSource();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: normalizedCode,
    client_id: clientId.value,
    client_secret: clientSecret.value,
    redirect_uri: callback.callbackUrl,
  });

  const response = await fetch(LINKEDIN_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const payload = await parseLinkedInJson(response);
  if (!response.ok) {
    const normalizedReason = inferTokenExchangeFailureReason(payload, response.status);
    if (isAuthorizationCodeMismatchError(payload)) {
      throw buildLinkedInApiError(
        "LINKEDIN_AUTHORIZATION_CODE_INVALID",
        "LinkedIn rejected the authorization code because it expired, was already used, or does not match the redirect URI.",
        {
          status: response.status,
          payload: {
            normalizedReason,
            redirectUri: callback.callbackUrl,
            redirectSource: callback.originSource,
            clientIdSource: clientId.source,
            clientSecretSource: clientSecret.source,
            pkceUsed: false,
            ...(payload ?? {}),
          },
          accountStatus: "INVALID_CREDENTIALS",
        },
      );
    }
    throw buildLinkedInApiError(
      "LINKEDIN_TOKEN_EXCHANGE_FAILED",
      normalizeLinkedInApiMessage(payload, "LinkedIn token exchange failed."),
      {
        status: response.status,
        payload: {
          normalizedReason,
          redirectUri: callback.callbackUrl,
          redirectSource: callback.originSource,
          clientIdSource: clientId.source,
          clientSecretSource: clientSecret.source,
          pkceUsed: false,
          ...(payload ?? {}),
        },
      },
    );
  }

  if (typeof payload?.access_token !== "string" || !payload.access_token.trim()) {
    throw buildLinkedInApiError(
      "LINKEDIN_TOKEN_MISSING",
      "LinkedIn token exchange did not return an access token.",
      { status: response.status, payload, accountStatus: "PENDING" },
    );
  }

  return {
    access_token: payload.access_token.trim(),
    expires_in: typeof payload.expires_in === "number" ? payload.expires_in : 0,
    scope: typeof payload.scope === "string" ? payload.scope : undefined,
    token_type: typeof payload.token_type === "string" ? payload.token_type : undefined,
    id_token: typeof payload.id_token === "string" ? payload.id_token : undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API — Profile fetch
// ---------------------------------------------------------------------------

export async function fetchLinkedInUserProfile(accessToken: string): Promise<LinkedInUserProfile> {
  const normalizedToken = accessToken.trim();
  if (!normalizedToken) {
    throw buildLinkedInApiError(
      "LINKEDIN_ACCESS_TOKEN_MISSING",
      "LinkedIn access token is required.",
      { accountStatus: "INVALID_CREDENTIALS" },
    );
  }

  const response = await fetch(LINKEDIN_USERINFO_ENDPOINT, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${normalizedToken}`,
    },
    cache: "no-store",
  });

  const payload = await parseLinkedInJson(response);
  if (!response.ok) {
    throw buildLinkedInApiError(
      "LINKEDIN_PROFILE_FETCH_FAILED",
      normalizeLinkedInApiMessage(payload, "LinkedIn profile lookup failed."),
      { status: response.status, payload },
    );
  }

  if (typeof payload?.sub !== "string" || !payload.sub.trim()) {
    throw buildLinkedInApiError(
      "LINKEDIN_PROFILE_ID_MISSING",
      "LinkedIn userinfo did not return a subject identifier.",
      { status: response.status, payload, accountStatus: "PENDING" },
    );
  }

  return {
    sub: payload.sub.trim(),
    name: typeof payload.name === "string" ? payload.name : undefined,
    given_name: typeof payload.given_name === "string" ? payload.given_name : undefined,
    family_name: typeof payload.family_name === "string" ? payload.family_name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
    locale: typeof payload.locale === "string" ? payload.locale : undefined,
    email: typeof payload.email === "string" ? payload.email : undefined,
    email_verified: typeof payload.email_verified === "boolean" ? payload.email_verified : undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API — Publishing
// ---------------------------------------------------------------------------

async function postLinkedInUgcContent(input: {
  accessToken: string;
  authorUrn: string;
  content: string;
  authorUrnMissingCode: string;
}): Promise<LinkedInPublishPostResult> {
  const accessToken = input.accessToken.trim();
  const authorUrn = input.authorUrn.trim();
  const content = input.content.trim();

  if (!accessToken) {
    throw buildLinkedInApiError(
      "LINKEDIN_ACCESS_TOKEN_MISSING",
      "LinkedIn access token is required.",
      { accountStatus: "INVALID_CREDENTIALS" },
    );
  }
  if (!authorUrn) {
    throw buildLinkedInApiError(
      input.authorUrnMissingCode,
      "LinkedIn author URN is required.",
      { accountStatus: "INVALID_CREDENTIALS" },
    );
  }
  if (!content) {
    throw buildLinkedInApiError(
      "LINKEDIN_POST_BODY_REQUIRED",
      "LinkedIn post content is required.",
      { accountStatus: "PENDING" },
    );
  }

  const payload = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text: content,
        },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const body = await parseLinkedInResponseBody(response);
  if (!response.ok) {
    const normalizedCode =
      response.status === 401
        ? "LINKEDIN_PUBLISH_TOKEN_INVALID"
        : response.status === 403
          ? "LINKEDIN_PUBLISH_FORBIDDEN"
          : response.status === 429
            ? "LINKEDIN_PUBLISH_RATE_LIMITED"
          : response.status === 400
            ? "LINKEDIN_PUBLISH_INVALID_REQUEST"
            : "LINKEDIN_PUBLISH_FAILED";

    throw buildLinkedInApiError(
      normalizedCode,
      normalizeLinkedInApiMessage(body, "LinkedIn publish failed."),
      {
        status: response.status,
        payload: body,
        accountStatus: response.status === 401 || response.status === 403 ? "INVALID_CREDENTIALS" : "PENDING",
      },
    );
  }

  return {
    externalPostId: response.headers.get("x-restli-id"),
    linkedinStatus: response.status,
    body,
  };
}

export async function publishLinkedInMemberPost(
  input: LinkedInPublishPostInput,
): Promise<LinkedInPublishPostResult> {
  return postLinkedInUgcContent({
    accessToken: input.accessToken,
    authorUrn: input.authorUrn,
    content: input.content,
    authorUrnMissingCode: "LINKEDIN_AUTHOR_URN_MISSING",
  });
}

export async function publishLinkedInOrganizationPost(
  input: LinkedInPublishOrganizationPostInput,
): Promise<LinkedInPublishPostResult> {
  return postLinkedInUgcContent({
    accessToken: input.accessToken,
    authorUrn: input.organizationUrn,
    content: input.content,
    authorUrnMissingCode: "LINKEDIN_ORGANIZATION_URN_MISSING",
  });
}

// ---------------------------------------------------------------------------
// Public API — Organization lookup (Company Page)
// ---------------------------------------------------------------------------

/**
 * Requires the `w_organization_social` scope to have actually been granted
 * (see isLinkedInOrganizationScopeEnabled). Lists organizations where the
 * connecting member has an ADMINISTRATOR role in APPROVED state.
 */
export async function fetchLinkedInAdministeredOrganizations(
  accessToken: string,
): Promise<LinkedInOrganizationAcl[]> {
  const normalizedToken = accessToken.trim();
  if (!normalizedToken) {
    throw buildLinkedInApiError(
      "LINKEDIN_ACCESS_TOKEN_MISSING",
      "LinkedIn access token is required.",
      { accountStatus: "INVALID_CREDENTIALS" },
    );
  }

  const url = new URL(LINKEDIN_ORGANIZATION_ACLS_ENDPOINT);
  url.searchParams.set("q", "roleAssignee");
  url.searchParams.set("role", "ADMINISTRATOR");
  url.searchParams.set("state", "APPROVED");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${normalizedToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    cache: "no-store",
  });

  const payload = await parseLinkedInResponseBody(response);
  if (!response.ok) {
    throw buildLinkedInApiError(
      "LINKEDIN_ORGANIZATION_LOOKUP_FAILED",
      normalizeLinkedInApiMessage(payload, "LinkedIn organization lookup failed."),
      { status: response.status, payload },
    );
  }

  const elements = Array.isArray(payload?.elements) ? payload.elements : [];
  return elements
    .map((element) => toLinkedInRecord(element))
    .filter((element): element is Record<string, unknown> => element !== null)
    .map((element): LinkedInOrganizationAcl => {
      const organizationUrn = typeof element.organization === "string" ? element.organization : "";
      const organizationId = organizationUrn.split(":").pop() ?? "";
      return {
        organizationUrn,
        organizationId,
        role: typeof element.role === "string" ? element.role : "",
        state: typeof element.state === "string" ? element.state : "",
      };
    })
    .filter((acl) => acl.organizationUrn.startsWith("urn:li:organization:"));
}

/**
 * Auto-selects the first administered organization. If the member administers
 * several Company Pages, this picks one deterministically (API order) rather
 * than prompting for a choice — revisit if multi-page selection UI is needed.
 */
export async function resolveLinkedInPrimaryOrganization(
  accessToken: string,
): Promise<LinkedInResolvedOrganization | null> {
  const organizations = await fetchLinkedInAdministeredOrganizations(accessToken);
  const primary = organizations[0];
  if (!primary) return null;

  return {
    organizationUrn: primary.organizationUrn,
    organizationId: primary.organizationId,
    name: null,
  };
}

// ---------------------------------------------------------------------------
// Public API — Identity resolution
// ---------------------------------------------------------------------------

export function resolveLinkedInIdentity(profile: LinkedInUserProfile): LinkedInResolvedIdentity {
  const profileId = profile.sub.trim();
  return {
    profileId,
    authorUrn: `urn:li:person:${profileId}`,
    displayName: resolveLinkedInDisplayName(profile),
    email: typeof profile.email === "string" ? profile.email : null,
    emailVerified: typeof profile.email_verified === "boolean" ? profile.email_verified : null,
    picture: typeof profile.picture === "string" ? profile.picture : null,
    locale: typeof profile.locale === "string" ? profile.locale : null,
  };
}

// ---------------------------------------------------------------------------
// Public API — Access verification
// ---------------------------------------------------------------------------

export async function verifyLinkedInAccess(accessToken: string): Promise<{
  displayName: string;
  authorUrn: string;
  profileId: string;
  email: string | null;
}> {
  const profile = await fetchLinkedInUserProfile(accessToken);
  const identity = resolveLinkedInIdentity(profile);
  return {
    displayName: identity.displayName,
    authorUrn: identity.authorUrn,
    profileId: identity.profileId,
    email: identity.email,
  };
}
