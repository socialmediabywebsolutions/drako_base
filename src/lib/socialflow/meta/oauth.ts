import { getSession, type SessionData } from "@/lib/auth/session";
import {
  MetaIntegrationError,
  exchangeMetaCodeForAccessToken,
  fetchInstagramBusinessAccount,
  fetchMetaPages,
  getMetaAppIdWithSource,
  resolveMetaOAuthDiagnostics,
  type MetaInstagramAccount,
} from "@/lib/socialflow/meta/core";
import { buildSocialFlowMetaAuthorizationUrl } from "@/lib/socialflow/meta/client";
import { persistSocialFlowMetaConnection } from "@/lib/socialflow/meta/repository";
import { verifyAndConsumeOAuthState } from "@/lib/socialflow/oauth/state";
import {
  SOCIALFLOW_META_CALLBACK_PATH,
  SOCIALFLOW_META_SETTINGS_PATH,
  type SocialFlowMetaCallbackFailure,
  type SocialFlowMetaCallbackResult,
  type SocialFlowMetaCallbackSuccess,
  type SocialFlowMetaConnectResult,
} from "@/lib/socialflow/meta/types";

function resolveDefaultRedirectTo(saasId: string | null | undefined): string {
  if (saasId?.trim()) {
    return `${SOCIALFLOW_META_SETTINGS_PATH}?saasId=${encodeURIComponent(saasId.trim())}`;
  }
  return SOCIALFLOW_META_SETTINGS_PATH;
}

function normalizeError(error: unknown): SocialFlowMetaCallbackFailure["error"] {
  if (error instanceof MetaIntegrationError) {
    const status =
      error.code === "META_CODE_MISSING" ? 400
      : error.code === "META_ENV_MISSING" ? 500
      : error.code === "META_NO_PAGES_FOUND" ? 400
      : error.code === "META_PAGES_FETCH_FAILED" || error.code === "META_INSTAGRAM_LOOKUP_FAILED" ? 502
      : error.code === "META_TOKEN_EXCHANGE_FAILED" || error.code === "META_LONG_LIVED_TOKEN_EXCHANGE_FAILED" ? 502
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
    code: "META_CALLBACK_FAILED",
    message: error instanceof Error ? error.message : "Unexpected Meta callback error.",
    details: null,
  };
}

function normalizePersistenceFailure(error: unknown) {
  if (error instanceof MetaIntegrationError) {
    return { code: error.code, message: error.message, details: error.details };
  }
  return {
    code: "META_PERSISTENCE_FAILED",
    message: error instanceof Error ? error.message : "Meta connection persistence failed.",
    details: null,
  };
}

export async function buildSocialFlowMetaConnectUrl(input: {
  request: Request;
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
}): Promise<SocialFlowMetaConnectResult> {
  return buildSocialFlowMetaAuthorizationUrl({
    request: input.request,
    appId: getMetaAppIdWithSource().value,
    tenantId: input.tenantId,
    saasId: input.saasId,
    redirectTo: input.redirectTo ?? resolveDefaultRedirectTo(input.saasId),
  });
}

export async function handleSocialFlowMetaCallback(
  request: Request,
  session?: SessionData | null,
): Promise<SocialFlowMetaCallbackResult> {
  const diagnostics = resolveMetaOAuthDiagnostics(request, { callbackPath: SOCIALFLOW_META_CALLBACK_PATH });
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() || "";
  const oauthError = url.searchParams.get("error")?.trim() || "";
  const verification = await verifyAndConsumeOAuthState(url.searchParams.get("state"), { provider: "meta" });

  if (!verification.ok) {
    return {
      ok: false,
      tenantId: null,
      saasId: null,
      redirectTo: resolveDefaultRedirectTo(null),
      diagnostics,
      error: {
        status: 400,
        code: verification.reason === "nonce_replayed" ? "META_STATE_REPLAYED" : "META_STATE_INVALID",
        message: `Meta callback state could not be verified (${verification.reason}).`,
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
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error: {
        status: 403,
        code: "TENANT_MISMATCH",
        message: "Meta callback tenant does not match the active SocialFlow session.",
        details: { sessionTenantId: session.tenantId, callbackTenantId: context.tenantId },
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
        code: "META_OAUTH_ERROR",
        message: `Meta OAuth error: ${oauthError}`,
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
      error: { status: 400, code: "META_CODE_MISSING", message: "Meta callback requires the code query param.", details: null },
    };
  }

  let token;
  try {
    token = await exchangeMetaCodeForAccessToken(code, request, { callbackPath: SOCIALFLOW_META_CALLBACK_PATH });
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

  let pages;
  try {
    pages = await fetchMetaPages(token.access_token);
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

  const page = pages[0];
  if (!page) {
    return {
      ok: false,
      tenantId: context.tenantId,
      saasId: context.saasId,
      redirectTo: context.redirectTo,
      diagnostics,
      error: {
        status: 400,
        code: "META_NO_PAGES_FOUND",
        message: "No Facebook Pages were found for this account. Grant access to at least one Page and try again.",
        details: null,
      },
    };
  }

  let instagramAccount: MetaInstagramAccount | null = null;
  try {
    instagramAccount = await fetchInstagramBusinessAccount(page.id, page.access_token);
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

  let persistence: SocialFlowMetaCallbackSuccess["persistence"];
  try {
    const persisted = await persistSocialFlowMetaConnection({
      tenantId: context.tenantId,
      saasId: context.saasId,
      token,
      page,
      instagramAccount,
    });
    persistence = { status: persisted.status, accountIds: persisted.accounts.map((account) => account.id) };
  } catch (error) {
    const failure = normalizePersistenceFailure(error);
    persistence = { status: "failed", code: failure.code, message: failure.message, details: failure.details };
  }

  return {
    ok: true,
    tenantId: context.tenantId,
    saasId: context.saasId,
    redirectTo: context.redirectTo,
    token,
    page,
    instagramAccount,
    persistence,
    diagnostics,
  };
}

export async function resolveSocialFlowMetaCallbackSession(request: Request) {
  return getSession(request).catch(() => null);
}
