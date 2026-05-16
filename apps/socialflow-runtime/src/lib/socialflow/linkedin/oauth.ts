import { getSocialFlowRuntimeEnv } from "../../runtime-env";
import {
  LinkedInIntegrationError,
  exchangeLinkedInCodeForAccessToken,
  fetchLinkedInUserProfile,
  parseLinkedInOAuthState,
  resolveLinkedInIdentity,
  resolveLinkedInOAuthDiagnostics,
} from "./core";
import { buildRuntimeLinkedInAuthorizationUrl } from "./client";
import { persistRuntimeLinkedInConnection } from "./repository";
import {
  SOCIALFLOW_LINKEDIN_CALLBACK_PATH,
  SOCIALFLOW_LINKEDIN_SETTINGS_PATH,
  type SocialFlowLinkedInCallbackContext,
  type SocialFlowLinkedInCallbackFailure,
  type SocialFlowLinkedInCallbackResult,
  type SocialFlowLinkedInCallbackSuccess,
  type SocialFlowLinkedInConnectResult,
} from "./types";

function getLinkedInClientId() {
  const runtimeEnv = getSocialFlowRuntimeEnv() as Record<string, unknown> | null;
  const runtimeValue = typeof runtimeEnv?.LINKEDIN_CLIENT_ID === "string" ? runtimeEnv.LINKEDIN_CLIENT_ID.trim() : "";
  if (runtimeValue) return runtimeValue;
  throw new LinkedInIntegrationError("LINKEDIN_CLIENT_ID is not configured.", {
    code: "LINKEDIN_ENV_MISSING",
    accountStatus: "PENDING",
    details: {
      key: "LINKEDIN_CLIENT_ID",
      attemptedSources: ["socialflow.runtime"],
    },
  });
}

function normalizeRelativePath(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  return trimmed;
}

function resolveDefaultRedirectTo(saasId: string | null | undefined) {
  if (saasId?.trim()) {
    return `${SOCIALFLOW_LINKEDIN_SETTINGS_PATH}?saasId=${encodeURIComponent(saasId.trim())}`;
  }
  return SOCIALFLOW_LINKEDIN_SETTINGS_PATH;
}

function resolveCallbackRedirectTo(input: {
  queryRedirectTo: string | null;
  stateRedirectTo: string | null;
  saasId: string | null;
}) {
  return normalizeRelativePath(input.queryRedirectTo)
    ?? normalizeRelativePath(input.stateRedirectTo)
    ?? resolveDefaultRedirectTo(input.saasId);
}

function resolveTenantAndSaas(request: Request, sessionTenantId?: string | null): SocialFlowLinkedInCallbackContext {
  const url = new URL(request.url);
  const state = parseLinkedInOAuthState(url.searchParams.get("state"));
  const tenantIdFromQuery = url.searchParams.get("tenantId")?.trim() || null;
  const saasIdFromQuery = url.searchParams.get("saasId")?.trim() || null;
  const tenantIdFromState = state?.tenantId?.trim() || null;
  const saasIdFromState = state?.saasId?.trim() || null;
  const tenantId = tenantIdFromQuery ?? tenantIdFromState ?? sessionTenantId ?? null;
  const saasId = saasIdFromQuery ?? saasIdFromState ?? null;
  const redirectTo = resolveCallbackRedirectTo({
    queryRedirectTo: url.searchParams.get("redirectTo"),
    stateRedirectTo: state?.redirectTo ?? null,
    saasId,
  });

  return {
    tenantId,
    saasId,
    redirectTo,
    resolution: {
      tenantId:
        tenantIdFromQuery ? "query"
        : tenantIdFromState ? `state:${state?.format ?? "unknown"}`
        : sessionTenantId ? "session"
        : "missing",
      saasId:
        saasIdFromQuery ? "query"
        : saasIdFromState ? `state:${state?.format ?? "unknown"}`
        : "missing",
      redirectTo:
        normalizeRelativePath(url.searchParams.get("redirectTo")) ? "query"
        : normalizeRelativePath(state?.redirectTo ?? null) ? `state:${state?.format ?? "unknown"}`
        : "default",
    },
    parsedState: state
      ? {
          tenantId: state.tenantId ?? null,
          saasId: state.saasId ?? null,
          redirectTo: state.redirectTo ?? null,
          format: state.format ?? null,
        }
      : null,
  };
}

function normalizeError(error: unknown): SocialFlowLinkedInCallbackFailure["error"] {
  if (error instanceof LinkedInIntegrationError) {
    const status =
      error.code === "LINKEDIN_CODE_MISSING"
        ? 400
        : error.code === "LINKEDIN_AUTHORIZATION_CODE_INVALID"
          ? 400
          : error.code === "LINKEDIN_ENV_MISSING"
            ? 500
            : error.code === "LINKEDIN_PROFILE_FETCH_FAILED" || error.code === "LINKEDIN_PROFILE_ID_MISSING"
              ? 502
              : 400;

    return {
      status,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  return {
    status: 500,
    code: "LINKEDIN_CALLBACK_FAILED",
    message: error instanceof Error ? error.message : "Unexpected LinkedIn callback error.",
    details: null,
  };
}

function normalizePersistenceFailure(error: unknown) {
  if (error instanceof LinkedInIntegrationError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  return {
    code: "LINKEDIN_PERSISTENCE_FAILED",
    message: error instanceof Error ? error.message : "LinkedIn connection persistence failed.",
    details: null,
  };
}

function resolveStorageAvailability() {
  const runtimeEnv = getSocialFlowRuntimeEnv();
  const hasSocialDb = Boolean(runtimeEnv?.SOCIAL_DB);
  return {
    hasSocialDb,
    persistenceAvailable: hasSocialDb,
    observabilityAvailable: false,
    missingBindings: hasSocialDb ? [] : ["SOCIAL_DB"],
  };
}

export function buildRuntimeLinkedInConnectUrl(input: {
  request: Request;
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
}): SocialFlowLinkedInConnectResult {
  return buildRuntimeLinkedInAuthorizationUrl({
    request: input.request,
    clientId: getLinkedInClientId(),
    tenantId: input.tenantId,
    saasId: input.saasId,
    redirectTo: input.redirectTo ?? resolveDefaultRedirectTo(input.saasId),
  });
}

export async function handleRuntimeLinkedInCallback(
  request: Request,
  session?: {
    userId: string;
    email: string;
    tenantId: string;
    role: "admin" | "user";
    issuedAt: number;
    authMode: "isolated";
  } | null,
): Promise<SocialFlowLinkedInCallbackResult> {
  const diagnostics = resolveLinkedInOAuthDiagnostics(request, {
    callbackPath: SOCIALFLOW_LINKEDIN_CALLBACK_PATH,
  });
  const context = resolveTenantAndSaas(request, session?.tenantId ?? null);
  const storage = resolveStorageAvailability();
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() || "";
  const oauthError = url.searchParams.get("error")?.trim() || "";

  if (session?.tenantId && context.tenantId && session.tenantId !== context.tenantId) {
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error: {
        status: 403,
        code: "TENANT_MISMATCH",
        message: "LinkedIn callback tenant does not match the active SocialFlow session.",
        details: {
          sessionTenantId: session.tenantId,
          callbackTenantId: context.tenantId,
        },
      },
    };
  }

  if (oauthError) {
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error: {
        status: 400,
        code: "LINKEDIN_OAUTH_ERROR",
        message: `LinkedIn OAuth error: ${oauthError}`,
        details: { providerError: oauthError },
      },
    };
  }

  if (!code) {
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error: {
        status: 400,
        code: "LINKEDIN_CODE_MISSING",
        message: "LinkedIn callback requires the code query param.",
        details: null,
      },
    };
  }

  if (!context.tenantId || !context.saasId) {
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error: {
        status: 400,
        code: "LINKEDIN_STATE_INVALID",
        message: "LinkedIn callback could not resolve tenantId and saasId from query, state, or session.",
        details: {
          resolution: context.resolution,
          parsedState: context.parsedState,
        },
      },
    };
  }

  let token;
  try {
    token = await exchangeLinkedInCodeForAccessToken(code, request, {
      callbackPath: SOCIALFLOW_LINKEDIN_CALLBACK_PATH,
    });
  } catch (error) {
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error: normalizeError(error),
    };
  }

  let profile;
  try {
    profile = await fetchLinkedInUserProfile(token.access_token);
  } catch (error) {
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error: normalizeError(error),
    };
  }

  try {
    const identity = resolveLinkedInIdentity(profile);

    let persistence: SocialFlowLinkedInCallbackSuccess["persistence"] = {
      status: "skipped",
      reason: "Persistence was not attempted.",
    };

    if (!storage.persistenceAvailable) {
      persistence = {
        status: "skipped",
        reason: `Runtime persistence unavailable: missing ${storage.missingBindings.join(", ")}.`,
      };
    } else {
      try {
        const persisted = await persistRuntimeLinkedInConnection({
          tenantId: context.tenantId,
          saasId: context.saasId,
          token,
          profile,
          identity,
        });
        persistence = {
          status: persisted.status,
          accountId: persisted.account.id,
          accountStatus: persisted.account.status,
        };
      } catch (error) {
        const failure = normalizePersistenceFailure(error);
        persistence = {
          status: "failed",
          code: failure.code,
          message: failure.message,
          details: failure.details,
        };
      }
    }

    return {
      ok: true,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      token,
      profile,
      identity,
      persistence,
      observability: storage.observabilityAvailable
        ? { status: "available" }
        : { status: "skipped", reason: "runtime-local provider isolation does not emit global observability events." },
      diagnostics,
    };
  } catch (error) {
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error: normalizeError(error),
    };
  }
}
