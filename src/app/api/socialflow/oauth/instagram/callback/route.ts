export const dynamic = "force-dynamic";

import {
  InstagramOAuthError,
  exchangeForLongLivedInstagramToken,
  exchangeInstagramCode,
  fetchInstagramUser,
  parseInstagramOAuthState,
  persistInstagramOAuthConnection,
  resolveInstagramCallbackUrl,
} from "@/lib/socialflow/instagram/oauth";

const DEFAULT_REDIRECT = "/socialflow/settings/accounts";

function buildRedirect(request: Request, targetPath: string, params: Record<string, string | null | undefined>) {
  const url = new URL(targetPath, request.url);
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawState = searchParams.get("state");
  const oauthError = searchParams.get("error")?.trim();
  const code = searchParams.get("code")?.trim() || "";

  const state = parseInstagramOAuthState(rawState);
  const redirectTo = state?.redirectTo || DEFAULT_REDIRECT;
  const saasId = state?.saasId || null;

  // User denied / Meta returned an error
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

  if (!state) {
    console.error("INSTAGRAM_OAUTH_CALLBACK_INVALID_STATE", { rawState });
    return Response.redirect(
      buildRedirect(request, redirectTo, { instagram: "error", code: "INSTAGRAM_STATE_INVALID", saasId }),
      308,
    );
  }

  try {
    const callbackUrl = resolveInstagramCallbackUrl(request);

    // Step 1 — exchange code for short-lived token
    const shortLived = await exchangeInstagramCode({ code, callbackUrl });

    // Step 2 — exchange for long-lived token (60 days)
    const longLived = await exchangeForLongLivedInstagramToken(shortLived.access_token);

    // Step 3 — fetch user info
    const user = await fetchInstagramUser(longLived.access_token);

    // Step 4 — persist account
    const { status, accountId } = await persistInstagramOAuthConnection({
      tenantId: state.tenantId,
      saasId: state.saasId,
      token: longLived,
      user,
    });

    console.log(`INSTAGRAM_OAUTH_SUCCESS tenantId=${state.tenantId} saasId=${state.saasId} igUserId=${user.id} status=${status}`);

    return Response.redirect(
      buildRedirect(request, state.redirectTo, {
        instagram: status === "updated" ? "reconnected" : "connected",
        provider: "instagram",
        saasId: state.saasId,
        accountId,
      }),
      308,
    );
  } catch (error) {
    const code = error instanceof InstagramOAuthError ? error.code : "INSTAGRAM_CALLBACK_FAILED";
    const message = error instanceof Error ? error.message : "Unexpected error during Instagram OAuth callback.";
    console.error("INSTAGRAM_OAUTH_CALLBACK_ERROR", code, message, error);

    return Response.redirect(
      buildRedirect(request, redirectTo, { instagram: "error", code, saasId }),
      308,
    );
  }
}
