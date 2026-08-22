import { resolveMetaOAuthDiagnostics } from "@/lib/socialflow/meta/core";
import { signOAuthState } from "@/lib/socialflow/oauth/state";
import {
  SOCIALFLOW_META_CALLBACK_PATH,
  SOCIALFLOW_META_SCOPES,
  type SocialFlowMetaConnectResult,
} from "@/lib/socialflow/meta/types";

const META_OAUTH_DIALOG_URL = "https://www.facebook.com/v19.0/dialog/oauth";

export async function buildSocialFlowMetaAuthorizationUrl(input: {
  request: Request;
  appId: string;
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
}): Promise<SocialFlowMetaConnectResult> {
  const diagnostics = resolveMetaOAuthDiagnostics(input.request, {
    callbackPath: SOCIALFLOW_META_CALLBACK_PATH,
  });
  const state = await signOAuthState({
    provider: "meta",
    tenantId: input.tenantId,
    saasId: input.saasId,
    redirectTo: input.redirectTo ?? null,
  });

  const authUrl = new URL(META_OAUTH_DIALOG_URL);
  authUrl.searchParams.set("client_id", input.appId);
  authUrl.searchParams.set("redirect_uri", diagnostics.callbackUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SOCIALFLOW_META_SCOPES);
  authUrl.searchParams.set("state", state);

  return {
    authorizationUrl: authUrl.toString(),
    state,
    callbackUrl: diagnostics.callbackUrl,
    diagnostics,
  };
}
