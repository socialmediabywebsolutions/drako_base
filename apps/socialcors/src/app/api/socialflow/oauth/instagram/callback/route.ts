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

// Bug fix — Instagram OAuth losing the session on return. APP_URL (the fixed
// origin Meta's redirect_uri must match exactly) is its own domain, distinct
// from BOTH customer-facing product domains (socialflow.drako.systems,
// socialcors.com) — so this callback request ALWAYS lands on an origin where a
// real customer's __Host- (origin-locked) session cookie was never set.
// buildRedirect now targets originUrl (the user's real browsing origin,
// captured at /connect time and carried through the signed state — see
// oauth/state.ts and instagram/oauth.ts) instead of this request's own origin,
// so every redirect out of this handler lands back where the cookie actually
// lives. Falls back to request.url's origin when originUrl is unavailable
// (states signed before this fix, or an unrecognized origin) — same behavior
// as before this change in that case.
function buildRedirect(
  request: Request,
  targetPath: string,
  params: Record<string, string | null | undefined>,
  originUrl?: string | null,
) {
  const url = new URL(targetPath, originUrl ?? request.url);
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
  const originUrl = verification.ok ? verification.originUrl : null;

  if (oauthError) {
    console.warn("INSTAGRAM_OAUTH_CALLBACK_DENIED", { error: oauthError, saasId });
    return Response.redirect(
      buildRedirect(request, redirectTo, { instagram: "error", code: "INSTAGRAM_OAUTH_DENIED", saasId }, originUrl),
      308,
    );
  }

  if (!code) {
    console.error("INSTAGRAM_OAUTH_CALLBACK_NO_CODE");
    return Response.redirect(
      buildRedirect(request, redirectTo, { instagram: "error", code: "INSTAGRAM_CODE_MISSING", saasId }, originUrl),
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
      }, originUrl),
      308,
    );
  }

  // Session tenant must match the signed state's tenantId WHEN a session is
  // present — the signature already proves the state wasn't forged; this extra
  // check guards against a *different* logged-in tenant redeeming someone
  // else's callback link. It does NOT require a session to exist: this request
  // lands on APP_URL's origin (see buildRedirect comment above), where a real
  // customer's session cookie for their actual product domain is never sent —
  // absent-session is the expected, normal case here, not a red flag. Treating
  // it as a hard failure was the actual bug: every real connection attempt hit
  // this branch and aborted before ever persisting the account, and the
  // resulting redirect (before originUrl existed) sent the user to an origin
  // with no session at all, which is what read as "lost session, bounced to
  // the public landing instead of the dashboard."
  const session = await getCurrentSocialFlowSessionFromRequest(request);
  if (session && session.tenantId !== verification.tenantId) {
    console.error("INSTAGRAM_OAUTH_CALLBACK_TENANT_MISMATCH", {
      sessionTenantId: session.tenantId,
      stateTenantId: verification.tenantId,
    });
    return Response.redirect(
      buildRedirect(request, redirectTo, { instagram: "error", code: "INSTAGRAM_TENANT_MISMATCH", saasId }, originUrl),
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
      }, originUrl),
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
      buildRedirect(request, redirectTo, { instagram: "error", code: errorCode, saasId }, originUrl),
      308,
    );
  }
}
