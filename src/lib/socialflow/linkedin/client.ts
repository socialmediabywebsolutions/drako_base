import { isLinkedInOrganizationScopeEnabled, resolveLinkedInOAuthDiagnostics } from "@/lib/socialflow/linkedin/core";
import { signOAuthState } from "@/lib/socialflow/oauth/state";
import {
  SOCIALFLOW_LINKEDIN_CALLBACK_PATH,
  SOCIALFLOW_LINKEDIN_MEMBER_SCOPES,
  SOCIALFLOW_LINKEDIN_ORGANIZATION_SCOPE,
  type SocialFlowLinkedInConnectResult,
} from "@/lib/socialflow/linkedin/types";

function resolveSocialFlowLinkedInScopes(): string {
  return isLinkedInOrganizationScopeEnabled()
    ? `${SOCIALFLOW_LINKEDIN_MEMBER_SCOPES} ${SOCIALFLOW_LINKEDIN_ORGANIZATION_SCOPE}`
    : SOCIALFLOW_LINKEDIN_MEMBER_SCOPES;
}

export async function buildSocialFlowLinkedInAuthorizationUrl(input: {
  request: Request;
  clientId: string;
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
}): Promise<SocialFlowLinkedInConnectResult> {
  const diagnostics = resolveLinkedInOAuthDiagnostics(input.request, {
    callbackPath: SOCIALFLOW_LINKEDIN_CALLBACK_PATH,
  });
  const state = await signOAuthState({
    provider: "linkedin",
    tenantId: input.tenantId,
    saasId: input.saasId,
    redirectTo: input.redirectTo ?? null,
  });

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("client_id", input.clientId);
  authUrl.searchParams.set("redirect_uri", diagnostics.callbackUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", resolveSocialFlowLinkedInScopes());
  authUrl.searchParams.set("state", state);

  return {
    authorizationUrl: authUrl.toString(),
    state,
    callbackUrl: diagnostics.callbackUrl,
    diagnostics,
  };
}
