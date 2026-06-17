import type {
  MetaInstagramAccount,
  MetaOAuthDiagnostics,
  MetaPage,
  MetaTokenResponse,
} from "@/lib/socialflow/meta/core";

export const SOCIALFLOW_META_CALLBACK_PATH = "/api/socialflow/meta/callback";
export const SOCIALFLOW_META_SETTINGS_PATH = "/socialflow/settings/accounts";
export const SOCIALFLOW_META_SCOPES =
  "pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights,instagram_content_publish,business_management";

export type SocialFlowMetaState = {
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
};

export type SocialFlowMetaCallbackContext = {
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

export type SocialFlowMetaConnectResult = {
  authorizationUrl: string;
  state: string;
  callbackUrl: string;
  diagnostics: MetaOAuthDiagnostics;
};

export type SocialFlowMetaCallbackSuccess = {
  ok: true;
  tenantId: string;
  saasId: string;
  redirectTo: string;
  token: MetaTokenResponse;
  page: MetaPage;
  instagramAccount: MetaInstagramAccount | null;
  persistence:
    | { status: "persisted" | "updated"; accountIds: string[] }
    | { status: "failed"; code: string; message: string; details: Record<string, unknown> | null };
  diagnostics: MetaOAuthDiagnostics;
};

export type SocialFlowMetaCallbackFailure = {
  ok: false;
  tenantId: string | null;
  saasId: string | null;
  redirectTo: string;
  diagnostics: MetaOAuthDiagnostics;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown> | null;
    status: number;
  };
};

export type SocialFlowMetaCallbackResult = SocialFlowMetaCallbackSuccess | SocialFlowMetaCallbackFailure;
