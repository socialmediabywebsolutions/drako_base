import { env } from "@/lib/cf";
// P5: sesión propia de SocialCors (__Host-socialflow_session), no la multi-producto del holding.
import { getCurrentSocialFlowSessionFromRequest } from "@/lib/socialflow/auth/request";

type CallbackSession = { tenantId: string };
import { emitLinkedInOAuthActivity } from "@/lib/socialflow/contracts/linkedin-oauth-runtime";
import {
  LinkedInIntegrationError,
  exchangeLinkedInCodeForAccessToken,
  fetchLinkedInUserProfile,
  resolveLinkedInIdentity,
  resolveLinkedInOAuthDiagnostics,
  resolveLinkedInPrimaryOrganization,
  type LinkedInResolvedOrganization,
} from "@/lib/socialflow/linkedin/core";
import { buildSocialFlowLinkedInAuthorizationUrl } from "@/lib/socialflow/linkedin/client";
import { persistSocialFlowLinkedInConnection } from "@/lib/socialflow/linkedin/repository";
import { verifyAndConsumeOAuthState } from "@/lib/socialflow/oauth/state";
import {
  SOCIALFLOW_LINKEDIN_CALLBACK_PATH,
  SOCIALFLOW_LINKEDIN_ORGANIZATION_SCOPE,
  SOCIALFLOW_LINKEDIN_SETTINGS_PATH,
  type SocialFlowLinkedInCallbackFailure,
  type SocialFlowLinkedInCallbackResult,
  type SocialFlowLinkedInCallbackSuccess,
  type SocialFlowLinkedInConnectResult,
} from "@/lib/socialflow/linkedin/types";

async function resolveGrantedLinkedInOrganization(token: { scope?: string }, accessToken: string): Promise<LinkedInResolvedOrganization | null> {
  const grantedScopes = (token.scope ?? "").split(/[\s,]+/).map((value) => value.trim());
  if (!grantedScopes.includes(SOCIALFLOW_LINKEDIN_ORGANIZATION_SCOPE)) {
    return null;
  }

  try {
    return await resolveLinkedInPrimaryOrganization(accessToken);
  } catch (error) {
    console.warn("LINKEDIN_ORGANIZATION_LOOKUP_FAILED", error instanceof Error ? error.message : error);
    return null;
  }
}

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

function resolveDefaultRedirectTo(saasId: string | null | undefined): string {
  if (saasId?.trim()) {
    return `${SOCIALFLOW_LINKEDIN_SETTINGS_PATH}?saasId=${encodeURIComponent(saasId.trim())}`;
  }
  return SOCIALFLOW_LINKEDIN_SETTINGS_PATH;
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
    await emitLinkedInOAuthActivity({
      tenantId: input.tenantId,
      saasId: input.saasId,
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

const SOCIAL_PERSISTENCE_BINDING_KEY = "SOCIAL_DB";
const CORE_PROJECTION_BINDING_KEY = ["DRACO", "DB"].join("_");

function resolveStorageAvailability() {
  const bindings = env() as Record<string, unknown> | null;
  const hasCoreProjectionBinding = Boolean(bindings?.[CORE_PROJECTION_BINDING_KEY]);
  const hasSocialDb = Boolean(bindings?.[SOCIAL_PERSISTENCE_BINDING_KEY]);

  return {
    hasCoreProjectionBinding,
    hasSocialDb,
    persistenceAvailable: hasSocialDb,
    observabilityAvailable: hasCoreProjectionBinding,
    persistenceMissingBindings: hasSocialDb ? [] : [SOCIAL_PERSISTENCE_BINDING_KEY],
    observabilityMissingBindings: hasCoreProjectionBinding ? [] : [CORE_PROJECTION_BINDING_KEY],
  };
}

export async function buildSocialFlowLinkedInConnectUrl(input: {
  request: Request;
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
}): Promise<SocialFlowLinkedInConnectResult> {
  return await buildSocialFlowLinkedInAuthorizationUrl({
    request: input.request,
    clientId: getLinkedInClientId(),
    tenantId: input.tenantId,
    saasId: input.saasId,
    redirectTo: input.redirectTo ?? resolveDefaultRedirectTo(input.saasId),
  });
}

export async function handleSocialFlowLinkedInCallback(
  request: Request,
  session?: CallbackSession | null,
): Promise<SocialFlowLinkedInCallbackResult> {
  const diagnostics = resolveLinkedInOAuthDiagnostics(request, {
    callbackPath: SOCIALFLOW_LINKEDIN_CALLBACK_PATH,
  });
  const storage = resolveStorageAvailability();
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() || "";
  const oauthError = url.searchParams.get("error")?.trim() || "";
  const verification = await verifyAndConsumeOAuthState(url.searchParams.get("state"), { provider: "linkedin" });

  if (!verification.ok) {
    return {
      ok: false,
      tenantId: null,
      saasId: null,
      redirectTo: resolveDefaultRedirectTo(null),
      diagnostics,
      error: {
        status: 400,
        code: verification.reason === "nonce_replayed" ? "LINKEDIN_STATE_REPLAYED" : "LINKEDIN_STATE_INVALID",
        message: `LinkedIn callback state could not be verified (${verification.reason}).`,
        details: { reason: verification.reason },
      },
    };
  }

  const context = {
    tenantId: verification.tenantId,
    saasId: verification.saasId,
    redirectTo: verification.redirectTo ?? resolveDefaultRedirectTo(verification.saasId),
  };

  if (session?.tenantId && session.tenantId !== context.tenantId) {
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
    const organization = await resolveGrantedLinkedInOrganization(token, token.access_token);

    let persistence: SocialFlowLinkedInCallbackSuccess["persistence"] = {
      status: "skipped",
      reason: "Persistence was not attempted.",
    };
    let observability: SocialFlowLinkedInCallbackSuccess["observability"] = storage.observabilityAvailable
      ? { status: "available" }
      : { status: "unavailable", missingBindings: storage.observabilityMissingBindings };

    if (!storage.persistenceAvailable) {
      persistence = {
        status: "skipped",
        reason: `Local persistence unavailable: missing ${storage.persistenceMissingBindings.join(", ")}.`,
      };
      observability = storage.observabilityAvailable
        ? { status: "skipped", reason: "persistence_not_attempted" }
        : { status: "unavailable", missingBindings: storage.observabilityMissingBindings };
    } else {
      try {
        const persisted = await persistSocialFlowLinkedInConnection({
          tenantId: context.tenantId,
          saasId: context.saasId,
          token,
          profile,
          identity,
          organization,
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
      organization,
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
  return getCurrentSocialFlowSessionFromRequest(request).catch(() => null);
}
