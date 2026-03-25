export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/cf";
import { recordObservabilityActivity } from "@/lib/observability-core";
import { persistLinkedInConnection } from "@/lib/social/linkedin-connection";
import {
  LinkedInIntegrationError,
  exchangeLinkedInCodeForAccessToken,
  fetchLinkedInUserProfile,
  parseLinkedInOAuthState,
  resolveLinkedInIdentity,
  resolveLinkedInTokenExchangeDiagnostics,
} from "@/lib/social/linkedin";

function resolveTenantAndSaas(request: Request, sessionTenantId?: string | null) {
  const url = new URL(request.url);
  const state = parseLinkedInOAuthState(url.searchParams.get("state"));
  const tenantIdFromQuery = url.searchParams.get("tenantId")?.trim() || null;
  const saasIdFromQuery = url.searchParams.get("saasId")?.trim() || null;
  const tenantIdFromState = state?.tenantId?.trim() || null;
  const saasIdFromState = state?.saasId?.trim() || null;
  const tenantId = tenantIdFromQuery ?? tenantIdFromState ?? sessionTenantId ?? null;
  const saasId = saasIdFromQuery ?? saasIdFromState ?? null;

  return {
    tenantId,
    saasId,
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
    },
  };
}

function normalizeError(error: unknown) {
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
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  const message = error instanceof Error ? error.message : "Unexpected LinkedIn callback error.";
  return {
    status: 500,
    error: {
      code: "LINKEDIN_CALLBACK_FAILED",
      message,
      details: null,
    },
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

function shouldExposeLinkedInDebug(debug: { runtime: string; origin: string }) {
  if (process.env.NODE_ENV !== "production") return true;
  return debug.runtime.includes("local") || debug.origin.includes("localhost") || debug.origin.includes("127.0.0.1");
}

function createLinkedInDebugPayload(request: Request) {
  const oauth = resolveLinkedInTokenExchangeDiagnostics(request);
  return {
    effectiveClientId: oauth.clientId,
    effectiveRedirectUri: oauth.callbackUrl,
    effectiveRuntime: oauth.runtime,
    effectiveOrigin: oauth.origin,
    redirectResolutionSource: oauth.originSource,
    credentialSource: {
      clientId: oauth.clientIdSource,
      clientSecret: oauth.clientSecretSource,
    },
    pkceUsed: oauth.pkceUsed,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() || "";
  const session = await getSession(request).catch(() => null);
  const context = resolveTenantAndSaas(request, session?.tenantId ?? null);
  const storage = resolveStorageAvailability();
  const debug = createLinkedInDebugPayload(request);
  const exposeDebug = shouldExposeLinkedInDebug({
    runtime: debug.effectiveRuntime,
    origin: debug.effectiveOrigin,
  });

  console.info("LINKEDIN_CALLBACK_DEBUG", {
    clientId: debug.effectiveClientId,
    redirectUri: debug.effectiveRedirectUri,
    runtime: debug.effectiveRuntime,
    redirectResolutionSource: debug.redirectResolutionSource,
    credentialSource: debug.credentialSource,
    requestUrl: request.url,
    host: request.headers.get("host"),
    origin: request.headers.get("origin"),
    state: url.searchParams.get("state"),
    pkceUsed: debug.pkceUsed,
  });

  if (!code) {
    return NextResponse.json(
      {
        ok: false,
        provider: "linkedin",
        tenantId: context.tenantId,
        saasId: context.saasId,
        context: context.resolution,
        tokenExchange: {
          status: "failed",
          error: {
            code: "LINKEDIN_CODE_MISSING",
            message: "LinkedIn callback requires the code query param.",
            details: null,
          },
        },
        profileFetch: {
          status: "skipped",
        },
        persistence: {
          status: "skipped",
          reason: "token_exchange_failed",
        },
        observability: {
          status: storage.observabilityAvailable ? "skipped" : "unavailable",
          missingBindings: storage.observabilityAvailable ? [] : storage.missingBindings,
        },
        ...(exposeDebug ? { debug } : {}),
      },
      { status: 400 },
    );
  }

  let token;
  try {
    token = await exchangeLinkedInCodeForAccessToken(code, request);
  } catch (error) {
    const normalized = normalizeError(error);
    await recordCallbackFailure({
      tenantId: context.tenantId,
      saasId: context.saasId,
      code: normalized.error.code,
      message: normalized.error.message,
    });
    return NextResponse.json(
      {
        ok: false,
        provider: "linkedin",
        tenantId: context.tenantId,
        saasId: context.saasId,
        context: context.resolution,
        tokenExchange: {
          status: "failed",
          error: normalized.error,
        },
        profileFetch: {
          status: "skipped",
        },
        persistence: {
          status: "skipped",
          reason: "token_exchange_failed",
        },
        observability: {
          status: storage.observabilityAvailable ? "skipped" : "unavailable",
          missingBindings: storage.observabilityAvailable ? [] : storage.missingBindings,
        },
        ...(exposeDebug ? { debug } : {}),
      },
      { status: normalized.status },
    );
  }

  let profile;
  try {
    profile = await fetchLinkedInUserProfile(token.access_token);
  } catch (error) {
    const normalized = normalizeError(error);
    await recordCallbackFailure({
      tenantId: context.tenantId,
      saasId: context.saasId,
      code: normalized.error.code,
      message: normalized.error.message,
    });
    return NextResponse.json(
      {
        ok: false,
        provider: "linkedin",
        tenantId: context.tenantId,
        saasId: context.saasId,
        context: context.resolution,
        tokenExchange: {
          status: "succeeded",
        },
        profileFetch: {
          status: "failed",
          error: normalized.error,
        },
        persistence: {
          status: "skipped",
          reason: "profile_fetch_failed",
        },
        observability: {
          status: storage.observabilityAvailable ? "skipped" : "unavailable",
          missingBindings: storage.observabilityAvailable ? [] : storage.missingBindings,
        },
        ...(exposeDebug ? { debug } : {}),
      },
      { status: normalized.status },
    );
  }

  try {
    const identity = resolveLinkedInIdentity(profile);

    let persistence:
      | { status: "persisted" | "updated"; accountId: string; accountStatus: string }
      | { status: "skipped"; reason: string }
      | { status: "failed"; code: string; message: string; details: Record<string, unknown> | null } = {
        status: "skipped",
        reason: "tenantId and saasId could not be resolved from query, state, or session.",
      };
    let observability:
      | { status: "available" }
      | { status: "unavailable"; missingBindings: string[] }
      | { status: "skipped"; reason: string } = storage.observabilityAvailable
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
    } else if (context.tenantId && context.saasId) {
      try {
        const persisted = await persistLinkedInConnection({
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

    return NextResponse.json({
      ok: true,
      provider: "linkedin",
      tenantId: context.tenantId,
      saasId: context.saasId,
      context: context.resolution,
      tokenExchange: {
        status: "succeeded",
      },
      profileFetch: {
        status: "succeeded",
      },
      token,
      profile,
      identity,
      persistence,
      observability,
      ...(exposeDebug ? { debug } : {}),
    });
  } catch (error) {
    const normalized = normalizeError(error);
    await recordCallbackFailure({
      tenantId: context.tenantId,
      saasId: context.saasId,
      code: normalized.error.code,
      message: normalized.error.message,
    });
    return NextResponse.json(
      {
        ok: false,
        provider: "linkedin",
        tenantId: context.tenantId,
        saasId: context.saasId,
        context: context.resolution,
        tokenExchange: {
          status: "succeeded",
        },
        profileFetch: {
          status: "succeeded",
        },
        persistence: {
          status: "skipped",
          reason: "callback_failed_after_profile_fetch",
        },
        observability: {
          status: storage.observabilityAvailable ? "skipped" : "unavailable",
          missingBindings: storage.observabilityAvailable ? [] : storage.missingBindings,
        },
        callbackError: normalized.error,
        ...(exposeDebug ? { debug } : {}),
      },
      { status: normalized.status },
    );
  }
}
