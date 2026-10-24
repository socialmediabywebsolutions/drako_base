import { getSocialFlowRuntimeEnv } from "../../runtime-env";
import { encodeLinkedInCanaryGateState } from "./canary-gate-state";
import { resolveLinkedInOAuthDiagnostics } from "./core";
import {
  SOCIALFLOW_LINKEDIN_CALLBACK_PATH,
  SOCIALFLOW_LINKEDIN_SCOPES,
  type SocialFlowLinkedInConnectResult,
  type SocialFlowLinkedInState,
} from "./types";

function encodeSocialFlowLinkedInState(input: SocialFlowLinkedInState) {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function resolveCanaryGateSecret() {
  const env = getSocialFlowRuntimeEnv();
  const value = env?.SOCIALFLOW_CANARY_GATE_TOKEN?.trim() ?? "";
  return value || null;
}

export async function buildRuntimeLinkedInAuthorizationUrl(input: {
  request: Request;
  clientId: string;
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
}): Promise<SocialFlowLinkedInConnectResult> {
  const diagnostics = resolveLinkedInOAuthDiagnostics(input.request, {
    callbackPath: SOCIALFLOW_LINKEDIN_CALLBACK_PATH,
  });
  const baseState = {
    tenantId: input.tenantId,
    saasId: input.saasId,
    redirectTo: input.redirectTo ?? null,
  };
  const gateSecret = resolveCanaryGateSecret();
  const state = gateSecret
    ? await encodeLinkedInCanaryGateState({
        tenantId: input.tenantId,
        saasId: input.saasId,
        redirectTo: input.redirectTo ?? null,
        gateSecret,
      })
    : encodeSocialFlowLinkedInState(baseState);

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("client_id", input.clientId);
  authUrl.searchParams.set("redirect_uri", diagnostics.callbackUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SOCIALFLOW_LINKEDIN_SCOPES);
  authUrl.searchParams.set("state", state);

  return {
    authorizationUrl: authUrl.toString(),
    state,
    callbackUrl: diagnostics.callbackUrl,
    diagnostics,
  };
}
