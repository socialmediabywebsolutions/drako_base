import { env } from "@/lib/cf";

const LINKEDIN_TOKEN_ENDPOINT = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_ENDPOINT = "https://api.linkedin.com/v2/userinfo";
const LINKEDIN_CALLBACK_PATH = "/auth/linkedin/callback";

type LinkedInEnvKey =
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

const LINKEDIN_BASE_URL_ENV_KEYS: LinkedInEnvKey[] = [
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "BASE_URL",
  "SITE_URL",
  "NEXTAUTH_URL",
  "CF_PAGES_URL",
];

type LinkedInErrorStatus = "INVALID_CREDENTIALS" | "PENDING";

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

export type LinkedInPublishPostResult = {
  externalPostId: string | null;
  linkedinStatus: number;
  body: Record<string, unknown> | null;
};

export type LinkedInOAuthState = {
  tenantId?: string | null;
  saasId?: string | null;
  redirectTo?: string | null;
  format?: "json" | "base64url-json" | "base64-json" | "compact";
};

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

export function resolveLinkedInCallback(request?: Request): LinkedInCallbackResolution {
  const requestOrigin = resolveRequestOrigin(request);
  if (requestOrigin) {
    return {
      callbackUrl: `${requestOrigin.value}${LINKEDIN_CALLBACK_PATH}`,
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
        callbackUrl: `${origin}${LINKEDIN_CALLBACK_PATH}`,
        origin,
        originSource: resolved.source,
        runtime: classifyLinkedInRuntime(origin),
      };
    }
  }

  const fallbackOrigin = "http://localhost:3000";
  return {
    callbackUrl: `${fallbackOrigin}${LINKEDIN_CALLBACK_PATH}`,
    origin: fallbackOrigin,
    originSource: "default.localhost:3000",
    runtime: "next-dev-local",
  };
}

export function resolveLinkedInCallbackUrl(request?: Request): string {
  return resolveLinkedInCallback(request).callbackUrl;
}

export function resolveLinkedInOAuthDiagnostics(request?: Request): LinkedInOAuthDiagnostics {
  const callback = resolveLinkedInCallback(request);
  const clientId = getLinkedInClientIdWithSource();
  return {
    ...callback,
    clientId: clientId.value,
    clientIdSource: clientId.source,
    pkceUsed: false,
  };
}

export function resolveLinkedInTokenExchangeDiagnostics(request?: Request): LinkedInOAuthDiagnostics {
  const diagnostics = resolveLinkedInOAuthDiagnostics(request);
  const clientSecret = getLinkedInClientSecretWithSource();
  return {
    ...diagnostics,
    clientSecretSource: clientSecret.source,
  };
}

function buildLinkedInApiError(code: string, message: string, opts?: {
  status?: number;
  payload?: Record<string, unknown> | null;
  accountStatus?: LinkedInErrorStatus;
}) {
  return new LinkedInIntegrationError(message, {
    code,
    accountStatus:
      opts?.accountStatus
      ?? (opts?.status === 401 || opts?.status === 403 ? "INVALID_CREDENTIALS" : "PENDING"),
    details: {
      status: opts?.status ?? null,
      ...(opts?.payload ?? {}),
    },
  });
}

function normalizeLinkedInApiMessage(payload: Record<string, unknown> | null, fallback: string): string {
  const parts = [
    typeof payload?.error_description === "string" ? payload.error_description : null,
    typeof payload?.message === "string" ? payload.message : null,
    typeof payload?.error === "string" ? payload.error : null,
  ].filter((value): value is string => Boolean(value?.trim()));

  return parts[0] ?? fallback;
}

function isAuthorizationCodeMismatchError(payload: Record<string, unknown> | null): boolean {
  const message = normalizeLinkedInApiMessage(payload, "").toLowerCase();
  return (
    message.includes("authorization code")
    || message.includes("código de autorización")
  ) && (
    message.includes("expired")
    || message.includes("caduc")
    || message.includes("reused")
    || message.includes("used")
    || message.includes("redirect")
    || message.includes("redirección")
    || message.includes("no coincide")
    || message.includes("code verifier")
    || message.includes("verificador de código")
  );
}

function inferTokenExchangeFailureReason(payload: Record<string, unknown> | null, status?: number): string {
  const message = normalizeLinkedInApiMessage(payload, "").toLowerCase();
  const error = typeof payload?.error === "string" ? payload.error.toLowerCase() : "";

  if (
    error.includes("invalid_client")
    || message.includes("client secret")
    || message.includes("client_id")
    || message.includes("appid")
  ) {
    return "client_credentials_invalid";
  }

  if (
    message.includes("redirect")
    || message.includes("redirecci")
    || message.includes("code verifier")
    || message.includes("verificador de c")
  ) {
    return "redirect_uri_mismatch";
  }

  if (message.includes("reused") || message.includes("already used") || message.includes("ya fue usado")) {
    return "authorization_code_reused";
  }

  if (message.includes("expired") || message.includes("caduc")) {
    return "authorization_code_expired";
  }

  if (status === 401 || status === 403) {
    return "client_credentials_invalid";
  }

  if (isAuthorizationCodeMismatchError(payload)) {
    return "authorization_code_expired_or_reused_or_redirect_mismatch";
  }

  return "unknown";
}

async function parseLinkedInJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function parseLinkedInResponseBody(response: Response): Promise<Record<string, unknown> | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("application/json")) {
    return parseLinkedInJson(response);
  }

  const text = await response.text().catch(() => "");
  if (!text.trim()) return null;
  return { raw: text };
}

function resolveLinkedInDisplayName(profile: LinkedInUserProfile): string {
  if (typeof profile.name === "string" && profile.name.trim()) {
    return profile.name.trim();
  }

  const fullName = [profile.given_name, profile.family_name]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .trim();

  return fullName || profile.sub;
}

export function parseLinkedInOAuthState(state: string | null): LinkedInOAuthState | null {
  if (!state?.trim()) return null;

  const rawState = state.trim();
  const attempts: Array<{ value: string; format: NonNullable<LinkedInOAuthState["format"]> }> = [
    { value: rawState, format: "json" },
  ];
  try {
    attempts.push({ value: Buffer.from(rawState, "base64url").toString("utf8"), format: "base64url-json" as const });
  } catch {}
  try {
    attempts.push({ value: Buffer.from(rawState, "base64").toString("utf8"), format: "base64-json" as const });
  } catch {}

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate.value) as Record<string, unknown>;
      return {
        tenantId: typeof parsed.tenantId === "string" ? parsed.tenantId : null,
        saasId: typeof parsed.saasId === "string" ? parsed.saasId : null,
        redirectTo: typeof parsed.redirectTo === "string" ? parsed.redirectTo : null,
        format: candidate.format,
      };
    } catch {}
  }

  const compactParts = rawState.split("__");
  if (compactParts.length === 2) {
    const [tenantId, saasId] = compactParts.map((value) => value.trim());
    if (tenantId && saasId) {
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

export async function exchangeLinkedInCodeForAccessToken(code: string, request?: Request): Promise<LinkedInTokenResponse> {
  const normalizedCode = code.trim();
  if (!normalizedCode) {
    throw buildLinkedInApiError(
      "LINKEDIN_CODE_MISSING",
      "LinkedIn authorization code is required.",
      { accountStatus: "PENDING" },
    );
  }

  const callback = resolveLinkedInCallback(request);
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

export async function publishLinkedInMemberPost(
  input: LinkedInPublishPostInput,
): Promise<LinkedInPublishPostResult> {
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
      "LINKEDIN_AUTHOR_URN_MISSING",
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
