import { resolveMetaOAuthDiagnostics } from "@/lib/socialflow/meta/core";
import {
  SOCIALFLOW_META_CALLBACK_PATH,
  SOCIALFLOW_META_SCOPES,
  type SocialFlowMetaConnectResult,
  type SocialFlowMetaState,
} from "@/lib/socialflow/meta/types";

const META_OAUTH_DIALOG_URL = "https://www.facebook.com/v19.0/dialog/oauth";

function encodeSocialFlowMetaState(input: SocialFlowMetaState): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

export function buildSocialFlowMetaAuthorizationUrl(input: {
  request: Request;
  appId: string;
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
}): SocialFlowMetaConnectResult {
  const diagnostics = resolveMetaOAuthDiagnostics(input.request, {
    callbackPath: SOCIALFLOW_META_CALLBACK_PATH,
  });
  const state = encodeSocialFlowMetaState({
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
