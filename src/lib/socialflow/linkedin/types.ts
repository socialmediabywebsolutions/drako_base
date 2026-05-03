import type {
  LinkedInOAuthDiagnostics,
  LinkedInResolvedIdentity,
  LinkedInTokenResponse,
  LinkedInUserProfile,
} from "@/lib/socialflow/linkedin/core";

export const SOCIALFLOW_LINKEDIN_CALLBACK_PATH = "/api/socialflow/linkedin/callback";
export const SOCIALFLOW_LINKEDIN_SETTINGS_PATH = "/socialflow/settings/account";
export const SOCIALFLOW_LINKEDIN_SCOPES = "r_liteprofile r_emailaddress";

export type SocialFlowLinkedInState = {
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
};

export type SocialFlowLinkedInCallbackContext = {
  tenantId: string | null;
  saasId: string | null;
  redirectTo: string;
  resolution: {
    tenantId: string;
    saasId: string;
    redirectTo: string;
  };
  parsedState: {
    tenantId?: string | null;
    saasId?: string | null;
    redirectTo?: string | null;
    format?: string | null;
  } | null;
};

export type SocialFlowLinkedInConnectResult = {
  authorizationUrl: string;
  state: string;
  callbackUrl: string;
  diagnostics: LinkedInOAuthDiagnostics;
};

export type SocialFlowLinkedInCallbackSuccess = {
  ok: true;
  tenantId: string;
  saasId: string;
  redirectTo: string;
  token: LinkedInTokenResponse;
  profile: LinkedInUserProfile;
  identity: LinkedInResolvedIdentity;
  persistence:
    | { status: "persisted" | "updated"; accountId: string; accountStatus: string }
    | { status: "skipped"; reason: string }
    | { status: "failed"; code: string; message: string; details: Record<string, unknown> | null };
  observability:
    | { status: "available" }
    | { status: "unavailable"; missingBindings: string[] }
    | { status: "skipped"; reason: string };
  diagnostics: LinkedInOAuthDiagnostics;
};

export type SocialFlowLinkedInCallbackFailure = {
  ok: false;
  tenantId: string | null;
  saasId: string | null;
  redirectTo: string;
  diagnostics: LinkedInOAuthDiagnostics;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown> | null;
    status: number;
  };
};

export type SocialFlowLinkedInCallbackResult =
  | SocialFlowLinkedInCallbackSuccess
  | SocialFlowLinkedInCallbackFailure;
