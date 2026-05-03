import { env } from "@/lib/cf";
import { getSession, type SessionData } from "@/lib/auth/session";
import { recordObservabilityActivity } from "@/lib/observability-core";
import {
  LinkedInIntegrationError,
  exchangeLinkedInCodeForAccessToken,
  fetchLinkedInUserProfile,
  parseLinkedInOAuthState,
  resolveLinkedInIdentity,
  resolveLinkedInOAuthDiagnostics,
} from "@/lib/socialflow/linkedin/core";
import { buildSocialFlowLinkedInAuthorizationUrl } from "@/lib/socialflow/linkedin/client";
import { persistSocialFlowLinkedInConnection } from "@/lib/socialflow/linkedin/repository";
import {
  SOCIALFLOW_LINKEDIN_CALLBACK_PATH,
  SOCIALFLOW_LINKEDIN_SETTINGS_PATH,
  type SocialFlowLinkedInCallbackContext,
  type SocialFlowLinkedInCallbackFailure,
  type SocialFlowLinkedInCallbackResult,
  type SocialFlowLinkedInCallbackSuccess,
  type SocialFlowLinkedInConnectResult,
} from "@/lib/socialflow/linkedin/types";

function getLinkedInClientId(): string {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim() || "";
  if (clientId) return clientId;

  const bindings = env() as Record<string, unknown> | null;
  const bindingValue = typeof bindings?.LINKEDIN_CLIENT_ID === "string" ? bindings.LINKEDIN_CLIENT_ID.trim() : "";
  if (bindingValue) return bindingValue;

  throw new LinkedInIntegrationError("LINKEDIN_CLIENT_ID is not configured.", {
    code: "LINKEDIN_ENV_MISSING",
    accountStatus: "PENDING",
    details: {
      key: "LINKEDIN_CLIENT_ID",
      attemptedSources: ["process.env", "cloudflare.env"],
    },
  });
}

function normalizeRelativePath(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  return trimmed;
}

function resolveDefaultRedirectTo(saasId: string | null | undefined): string {
  if (saasId?.trim()) {
    return `${SOCIALFLOW_LINKEDIN_SETTINGS_PATH}?saasId=${encodeURIComponent(saasId.trim())}`;
  }
  return SOCIALFLOW_LINKEDIN_SETTINGS_PATH;
}

function resolveCallbackRedirectTo(input: {
  queryRedirectTo: string | null;
  stateRedirectTo: string | null;
  saasId: string | null;
}): string {
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

async function recordCallbackFailure(input: {
  tenantId: string | null;
  saasId: string | null;
  code: string;
  message: string;
}) {
  if (!input.tenantId || !input.saasId) return;

  try {
    await recordObservabilityActivity({
      tenantId: input.tenantId,
      saasId: input.saasId,
      sourceType: "integration",
      sourceKey: "linkedin",
      activityType: "linkedin_oauth_callback",
      status: "error",
      summary: input.message,
      metadata: {
        errorCode: input.code,
      },
    });
  } catch (activityError) {
    console.error("LINKEDIN_CALLBACK_ACTIVITY_ERROR", activityError);
  }
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
  const bindings = env();
  const hasDracoDb = Boolean(bindings?.DRACO_DB);
  const hasSocialDb = Boolean(bindings?.SOCIAL_DB);

  return {
    hasDracoDb,
    hasSocialDb,
    persistenceAvailable: hasDracoDb && hasSocialDb,
    observabilityAvailable: hasDracoDb,
    missingBindings: [
      ...(hasDracoDb ? [] : ["DRACO_DB"]),
      ...(hasSocialDb ? [] : ["SOCIAL_DB"]),
    ],
  };
}

export function buildSocialFlowLinkedInConnectUrl(input: {
  request: Request;
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
}): SocialFlowLinkedInConnectResult {
  return buildSocialFlowLinkedInAuthorizationUrl({
    request: input.request,
    clientId: getLinkedInClientId(),
    tenantId: input.tenantId,
    saasId: input.saasId,
    redirectTo: input.redirectTo ?? resolveDefaultRedirectTo(input.saasId),
  });
}

export async function handleSocialFlowLinkedInCallback(
  request: Request,
  session?: SessionData | null,
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
    const error = {
      status: 403,
      code: "TENANT_MISMATCH",
      message: "LinkedIn callback tenant does not match the active SocialFlow session.",
      details: {
        sessionTenantId: session.tenantId,
        callbackTenantId: context.tenantId,
      },
    };
    await recordCallbackFailure({
      tenantId: context.tenantId,
      saasId: context.saasId,
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error,
    };
  }

  if (oauthError) {
    const error = {
      status: 400,
      code: "LINKEDIN_OAUTH_ERROR",
      message: `LinkedIn OAuth error: ${oauthError}`,
      details: {
        providerError: oauthError,
      },
    };
    await recordCallbackFailure({
      tenantId: context.tenantId,
      saasId: context.saasId,
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error,
    };
  }

  if (!code) {
    const error = {
      status: 400,
      code: "LINKEDIN_CODE_MISSING",
      message: "LinkedIn callback requires the code query param.",
      details: null,
    };
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error,
    };
  }

  if (!context.tenantId || !context.saasId) {
    const error = {
      status: 400,
      code: "LINKEDIN_STATE_INVALID",
      message: "LinkedIn callback could not resolve tenantId and saasId from query, state, or session.",
      details: {
        resolution: context.resolution,
        parsedState: context.parsedState,
      },
    };
    await recordCallbackFailure({
      tenantId: context.tenantId,
      saasId: context.saasId,
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error,
    };
  }

  let token;
  try {
    token = await exchangeLinkedInCodeForAccessToken(code, request, {
      callbackPath: SOCIALFLOW_LINKEDIN_CALLBACK_PATH,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    await recordCallbackFailure({
      tenantId: context.tenantId,
      saasId: context.saasId,
      code: normalized.code,
      message: normalized.message,
    });
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error: normalized,
    };
  }

  let profile;
  try {
    profile = await fetchLinkedInUserProfile(token.access_token);
  } catch (error) {
    const normalized = normalizeError(error);
    await recordCallbackFailure({
      tenantId: context.tenantId,
      saasId: context.saasId,
      code: normalized.code,
      message: normalized.message,
    });
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error: normalized,
    };
  }

  try {
    const identity = resolveLinkedInIdentity(profile);

    let persistence: SocialFlowLinkedInCallbackSuccess["persistence"] = {
      status: "skipped",
      reason: "Persistence was not attempted.",
    };
    let observability: SocialFlowLinkedInCallbackSuccess["observability"] = storage.observabilityAvailable
      ? { status: "available" }
      : { status: "unavailable", missingBindings: storage.missingBindings };

    if (!storage.persistenceAvailable) {
      persistence = {
        status: "skipped",
        reason: `Local persistence unavailable: missing ${storage.missingBindings.join(", ")}.`,
      };
      observability = storage.observabilityAvailable
        ? { status: "skipped", reason: "persistence_not_attempted" }
        : { status: "unavailable", missingBindings: storage.missingBindings };
    } else {
      try {
        const persisted = await persistSocialFlowLinkedInConnection({
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
        await recordCallbackFailure({
          tenantId: context.tenantId,
          saasId: context.saasId,
          code: failure.code,
          message: failure.message,
        });
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
      observability,
      diagnostics,
    };
  } catch (error) {
    const normalized = normalizeError(error);
    await recordCallbackFailure({
      tenantId: context.tenantId,
      saasId: context.saasId,
      code: normalized.code,
      message: normalized.message,
    });
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error: normalized,
    };
  }
}

export async function resolveSocialFlowLinkedInCallbackSession(request: Request) {
  return getSession(request).catch(() => null);
}
