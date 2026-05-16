import { getSocialFlowRuntimeEnv } from "../../runtime-env";

const LINKEDIN_TOKEN_ENDPOINT = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_ENDPOINT = "https://api.linkedin.com/v2/userinfo";
const LINKEDIN_CALLBACK_PATH = "/auth/linkedin/callback";

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

const LINKEDIN_BASE_URL_ENV_KEYS: LinkedInEnvKey[] = [
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "BASE_URL",
  "SITE_URL",
  "NEXTAUTH_URL",
  "CF_PAGES_URL",
];

function toLinkedInRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function decodeLinkedInState(value: string, encoding: "base64url" | "base64"): string | null {
  try {
    return Buffer.from(value, encoding).toString("utf8");
  } catch {
    return null;
  }
}

function normalizeLinkedInOAuthStatePayload(
  payload: Record<string, unknown>,
  format: LinkedInOAuthState["format"],
): LinkedInOAuthState | null {
  const tenantId = typeof payload.tenantId === "string" && payload.tenantId.trim() ? payload.tenantId.trim() : null;
  const saasId = typeof payload.saasId === "string" && payload.saasId.trim() ? payload.saasId.trim() : null;
  const redirectTo = typeof payload.redirectTo === "string" && payload.redirectTo.trim() ? payload.redirectTo.trim() : null;

  if (!tenantId && !saasId && !redirectTo) return null;
  return { tenantId, saasId, redirectTo, format };
}

async function parseLinkedInJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return toLinkedInRecord(await response.json());
  } catch {
    return null;
  }
}

async function parseLinkedInResponseBody(response: Response): Promise<Record<string, unknown> | null> {
  const payload = await parseLinkedInJson(response);
  if (payload) return payload;
  try {
    const text = await response.text();
    return text.trim() ? { message: text } : null;
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

  if (description.includes("caduc") || description.includes("expired")) return "authorization_code_expired";
  if (description.includes("already used") || description.includes("reused")) return "authorization_code_reused";
  if (description.includes("redirect") || description.includes("does not match")) return "redirect_uri_mismatch";
  if (status === 401) return "authorization_code_expired_or_reused_or_redirect_mismatch";
  return "token_exchange_failed";
}

function isAuthorizationCodeMismatchError(payload: Record<string, unknown> | null): boolean {
  const description = `${typeof payload?.error === "string" ? payload.error : ""} ${typeof payload?.error_description === "string" ? payload.error_description : ""}`
    .toLowerCase()
    .trim();
  return description.includes("authorization code") || description.includes("code");
}

function buildLinkedInApiError(
  code: string,
  message: string,
  options?: {
    status?: number;
    payload?: Record<string, unknown> | null;
    accountStatus?: LinkedInErrorStatus;
  },
) {
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

function resolveLinkedInEnvValue(key: LinkedInEnvKey): LinkedInResolvedValue | null {
  const processValue = process.env[key];
  if (typeof processValue === "string" && processValue.trim()) {
    return { value: processValue.trim(), source: `process.env.${key}` };
  }

  const runtimeEnv = getSocialFlowRuntimeEnv() as Record<string, unknown> | null;
  const runtimeValue = runtimeEnv?.[key];
  if (typeof runtimeValue === "string" && runtimeValue.trim()) {
    return { value: runtimeValue.trim(), source: `socialflow.runtime.${key}` };
  }

  return null;
}

function getLinkedInClientIdWithSource(): LinkedInResolvedValue {
  const resolved = resolveLinkedInEnvValue("LINKEDIN_CLIENT_ID");
  if (resolved) return resolved;
  throw new LinkedInIntegrationError("LINKEDIN_CLIENT_ID is not configured.", {
    code: "LINKEDIN_ENV_MISSING",
    accountStatus: "PENDING",
    details: { key: "LINKEDIN_CLIENT_ID", attemptedSources: ["process.env", "socialflow.runtime"] },
  });
}

function getLinkedInClientSecretWithSource(): LinkedInResolvedValue {
  const resolved = resolveLinkedInEnvValue("LINKEDIN_CLIENT_SECRET");
  if (resolved) return resolved;
  throw new LinkedInIntegrationError("LINKEDIN_CLIENT_SECRET is not configured.", {
    code: "LINKEDIN_ENV_MISSING",
    accountStatus: "PENDING",
    details: { key: "LINKEDIN_CLIENT_SECRET", attemptedSources: ["process.env", "socialflow.runtime"] },
  });
}

function normalizeOrigin(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
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
  if (hostname.endsWith(".workers.dev")) return "worker";
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
  return normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
}

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

export function parseLinkedInOAuthState(rawState: string | null | undefined): LinkedInOAuthState | null {
  const normalizedState = rawState?.trim();
  if (!normalizedState) return null;

  if (normalizedState.startsWith("{")) {
    try {
      const payload = toLinkedInRecord(JSON.parse(normalizedState));
      return payload ? normalizeLinkedInOAuthStatePayload(payload, "json") : null;
    } catch {
      return null;
    }
  }

  const base64UrlDecoded = decodeLinkedInState(normalizedState, "base64url");
  if (base64UrlDecoded?.trim().startsWith("{")) {
    try {
      const payload = toLinkedInRecord(JSON.parse(base64UrlDecoded));
      return payload ? normalizeLinkedInOAuthStatePayload(payload, "base64url-json") : null;
    } catch {
      return null;
    }
  }

  const base64Decoded = decodeLinkedInState(normalizedState, "base64");
  if (base64Decoded?.trim().startsWith("{")) {
    try {
      const payload = toLinkedInRecord(JSON.parse(base64Decoded));
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
      return { tenantId, saasId, redirectTo: null, format: "compact" };
    }
  }

  return null;
}

export async function exchangeLinkedInCodeForAccessToken(
  code: string,
  request?: Request,
  options?: LinkedInCallbackOptions,
): Promise<LinkedInTokenResponse> {
  const normalizedCode = code.trim();
  if (!normalizedCode) {
    throw buildLinkedInApiError("LINKEDIN_CODE_MISSING", "LinkedIn authorization code is required.", {
      accountStatus: "PENDING",
    });
  }

  const callback = resolveLinkedInCallback(request, options);
  const clientId = getLinkedInClientIdWithSource();
  const clientSecret = getLinkedInClientSecretWithSource();

  const response = await fetch(LINKEDIN_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: normalizedCode,
      client_id: clientId.value,
      client_secret: clientSecret.value,
      redirect_uri: callback.callbackUrl,
    }),
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
    throw buildLinkedInApiError("LINKEDIN_TOKEN_MISSING", "LinkedIn token exchange did not return an access token.", {
      status: response.status,
      payload,
      accountStatus: "PENDING",
    });
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
    throw buildLinkedInApiError("LINKEDIN_ACCESS_TOKEN_MISSING", "LinkedIn access token is required.", {
      accountStatus: "INVALID_CREDENTIALS",
    });
  }

  const response = await fetch(LINKEDIN_USERINFO_ENDPOINT, {
    method: "GET",
    headers: { Authorization: `Bearer ${normalizedToken}` },
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

export async function publishLinkedInMemberPost(input: LinkedInPublishPostInput): Promise<LinkedInPublishPostResult> {
  const accessToken = input.accessToken.trim();
  const authorUrn = input.authorUrn.trim();
  const content = input.content.trim();

  if (!accessToken) {
    throw buildLinkedInApiError("LINKEDIN_ACCESS_TOKEN_MISSING", "LinkedIn access token is required.", {
      accountStatus: "INVALID_CREDENTIALS",
    });
  }
  if (!authorUrn) {
    throw buildLinkedInApiError("LINKEDIN_AUTHOR_URN_MISSING", "LinkedIn author URN is required.", {
      accountStatus: "INVALID_CREDENTIALS",
    });
  }
  if (!content) {
    throw buildLinkedInApiError("LINKEDIN_POST_BODY_REQUIRED", "LinkedIn post content is required.", {
      accountStatus: "PENDING",
    });
  }

  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: content },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }),
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

export async function verifyLinkedInAccess(accessToken: string) {
  const profile = await fetchLinkedInUserProfile(accessToken);
  const identity = resolveLinkedInIdentity(profile);
  return {
    displayName: identity.displayName,
    authorUrn: identity.authorUrn,
    profileId: identity.profileId,
    email: identity.email,
  };
}
