import type {
  MetaInstagramAccount,
  MetaOAuthDiagnostics,
  MetaPage,
  MetaTokenResponse,
} from "@/lib/socialflow/meta/core";

export const SOCIALFLOW_META_CALLBACK_PATH = "/api/socialflow/meta/callback";
export const SOCIALFLOW_META_SETTINGS_PATH = "/socialflow/settings/accounts";
// Solo permisos de Páginas de Facebook (+ business_management, necesario para listar
// Páginas gestionadas desde un Business Manager). Instagram se conecta por su propio OAuth
// (instagram/oauth.ts, INSTAGRAM_OAUTH_SCOPES), así que este flujo ya no pide instagram_*.
export const SOCIALFLOW_META_SCOPES =
  "pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_engagement,pages_read_user_content,business_management";

export type SocialFlowMetaCallbackContext = {
  tenantId: string;
  saasId: string;
  redirectTo: string;
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

// El usuario administra varias Páginas: se guardan en una selección pendiente
// (meta/pending-pages.ts) y el callback redirige a la pantalla de selección.
export type SocialFlowMetaCallbackSelectPage = {
  ok: true;
  selectionRequired: true;
  pendingSelectionId: string;
  pageCount: number;
  tenantId: string;
  saasId: string;
  redirectTo: string;
  diagnostics: MetaOAuthDiagnostics;
};

export type SocialFlowMetaCallbackResult = SocialFlowMetaCallbackSuccess | SocialFlowMetaCallbackSelectPage | SocialFlowMetaCallbackFailure;
