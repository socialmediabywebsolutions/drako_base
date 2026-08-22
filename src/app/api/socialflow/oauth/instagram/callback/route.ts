export const dynamic = "force-dynamic";

import { getCurrentSocialFlowSessionFromRequest } from "@/lib/socialflow/auth/request";
import {
  InstagramOAuthError,
  exchangeForLongLivedInstagramToken,
  exchangeInstagramCode,
  fetchInstagramUser,
  persistInstagramOAuthConnection,
  resolveInstagramCallbackUrl,
} from "@/lib/socialflow/instagram/oauth";
import { verifyAndConsumeOAuthState } from "@/lib/socialflow/oauth/state";

const DEFAULT_REDIRECT = "/socialflow/settings/accounts";

function buildRedirect(request: Request, targetPath: string, params: Record<string, string | null | undefined>) {
  const url = new URL(targetPath, request.url);
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function GET(request: Request) {
  console.log("INSTAGRAM_OAUTH_CALLBACK_ENTRY", { url: request.url.split("?")[0] });

  const { searchParams } = new URL(request.url);
  const oauthError = searchParams.get("error")?.trim();
  const code = searchParams.get("code")?.trim() || "";

  const verification = await verifyAndConsumeOAuthState(searchParams.get("state"), { provider: "instagram" });
  const redirectTo = verification.ok ? (verification.redirectTo ?? DEFAULT_REDIRECT) : DEFAULT_REDIRECT;
  const saasId = verification.ok ? verification.saasId : null;

  if (oauthError) {
    console.warn("INSTAGRAM_OAUTH_CALLBACK_DENIED", { error: oauthError, saasId });
    return Response.redirect(
      buildRedirect(request, redirectTo, { instagram: "error", code: "INSTAGRAM_OAUTH_DENIED", saasId }),
      308,
    );
  }

  if (!code) {
    console.error("INSTAGRAM_OAUTH_CALLBACK_NO_CODE");
    return Response.redirect(
      buildRedirect(request, redirectTo, { instagram: "error", code: "INSTAGRAM_CODE_MISSING", saasId }),
      308,
    );
  }

  if (!verification.ok) {
    console.error("INSTAGRAM_OAUTH_CALLBACK_INVALID_STATE", { reason: verification.reason });
    return Response.redirect(
      buildRedirect(request, redirectTo, {
        instagram: "error",
        code: verification.reason === "nonce_replayed" ? "INSTAGRAM_STATE_REPLAYED" : "INSTAGRAM_STATE_INVALID",
        saasId,
      }),
      308,
    );
  }

  // Session tenant must match the signed state's tenantId — the signature already
  // proves the state wasn't forged; this proves it wasn't issued for a *different*
  // tenant's connect flow than the one currently logged in.
  const session = await getCurrentSocialFlowSessionFromRequest(request);
  if (!session || session.tenantId !== verification.tenantId) {
    console.error("INSTAGRAM_OAUTH_CALLBACK_TENANT_MISMATCH", {
      sessionTenantId: session?.tenantId ?? null,
      stateTenantId: verification.tenantId,
    });
    return Response.redirect(
      buildRedirect(request, redirectTo, { instagram: "error", code: "INSTAGRAM_TENANT_MISMATCH", saasId }),
      308,
    );
  }

  // callbackUrl comes from the signed state (set during /connect) — guarantees exact
  // match with what Instagram saw in the auth dialog. Falls back to header-derived URL
  // only if a state was somehow signed without one (shouldn't happen in practice, see
  // buildInstagramAuthorizationUrl).
  const callbackUrl = verification.callbackUrl ?? resolveInstagramCallbackUrl(request);

  try {
    // Step 1 — exchange code immediately, before any other async work.
    // Instagram codes are single-use and short-lived; any extra await before this
    // increases the risk of "code already used or expired" errors.
    const shortLived = await exchangeInstagramCode({ code, callbackUrl });
    console.log("INSTAGRAM_TOKEN_EXCHANGE_OK", { saasId: verification.saasId, callbackUrl });

    // Step 2 — exchange for long-lived token (60 days)
    const longLived = await exchangeForLongLivedInstagramToken(shortLived.access_token);

    // Step 3 — fetch user info
    const user = await fetchInstagramUser(longLived.access_token);

    // Step 4 — persist account
    const { status, accountId } = await persistInstagramOAuthConnection({
      tenantId: verification.tenantId,
      saasId: verification.saasId,
      token: longLived,
      user,
    });

    console.log("INSTAGRAM_OAUTH_SUCCESS", {
      tenantId: verification.tenantId,
      saasId: verification.saasId,
      igUserId: user.id,
      status,
    });

    return Response.redirect(
      buildRedirect(request, redirectTo, {
        instagram: status === "updated" ? "reconnected" : "connected",
        provider: "instagram",
        saasId: verification.saasId,
        accountId,
      }),
      308,
    );
  } catch (error) {
    const errorCode = error instanceof InstagramOAuthError ? error.code : "INSTAGRAM_CALLBACK_FAILED";
    const message = error instanceof Error ? error.message : "Unexpected error during Instagram OAuth callback.";
    const details = error instanceof InstagramOAuthError ? error.details : null;
    console.error("INSTAGRAM_OAUTH_CALLBACK_ERROR", JSON.stringify({
      code: errorCode,
      message,
      details,
      callbackUrl,
      saasId: verification.saasId,
    }));

    return Response.redirect(
      buildRedirect(request, redirectTo, { instagram: "error", code: errorCode, saasId }),
      308,
    );
  }
}
