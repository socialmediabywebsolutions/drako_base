// Threads API — Meta Threads Platform
// Documentación: https://developers.facebook.com/docs/threads
// - Auth URL: https://threads.net/oauth/authorize
// - Token URL: https://graph.threads.net/oauth/access_token
// - API base: https://graph.threads.net/v1.0
//
// Requires the same Meta App (INSTAGRAM_APP_ID) with "Threads API" product enabled.
// Scopes: threads_basic, threads_content_publish
// Long-lived token: GET /access_token?grant_type=th_exchange_token (60 days)
// No refresh token — user must reconnect after expiry.
//
// Publishing flow (two-step):
//   1. POST /{user-id}/threads  → { id: creationId }
//   2. POST /{user-id}/threads_publish?creation_id={creationId} → { id: postId }
//
// Media types: TEXT (no image), IMAGE (single image URL), VIDEO (MP4 URL),
//   CAROUSEL_ALBUM (2–20 items, each created first as a child container).
//
// IMPORTANT: The Threads App needs to be added to the Meta App under
//   App Dashboard → Add Product → Threads API. The App ID is the same as Instagram
//   (INSTAGRAM_APP_ID) but requires a separate Threads OAuth flow.
//   Set THREADS_APP_SECRET as a Wrangler secret (same value as the Meta App Secret).

export const SOCIALFLOW_THREADS_API_BASE = "https://graph.threads.net/v1.0";
export const SOCIALFLOW_THREADS_AUTH_BASE = "https://threads.net/oauth/authorize";
export const SOCIALFLOW_THREADS_TOKEN_URL = "https://graph.threads.net/oauth/access_token";
export const SOCIALFLOW_THREADS_EXCHANGE_URL = "https://graph.threads.net/access_token";
export const SOCIALFLOW_THREADS_CALLBACK_PATH = "/api/socialflow/threads/callback";
export const SOCIALFLOW_THREADS_SETTINGS_PATH = "/socialflow/settings/account";
// Minimum required scopes for publishing text + image posts.
export const SOCIALFLOW_THREADS_SCOPES = "threads_basic,threads_content_publish";

export type ThreadsMediaType = "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";

export type ThreadsTokenResponse = {
  access_token: string;
  token_type: string;
};

export type ThreadsLongLivedTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds — typically 5184000 (60 days)
};

export type ThreadsUserProfile = {
  id: string;       // Threads user ID (different from Instagram user ID)
  username: string;
  name?: string;
};

export type ThreadsCreationResponse = {
  id: string; // creation container ID — pass to threads_publish
};

export type ThreadsPublishResponse = {
  id: string; // permanent Threads post ID
};

export type SocialFlowThreadsCallbackSuccess = {
  ok: true;
  tenantId: string;
  saasId: string;
  redirectTo: string;
  userId: string;
  username: string;
  accountId: string;
};

export type SocialFlowThreadsCallbackFailure = {
  ok: false;
  tenantId: string | null;
  saasId: string | null;
  redirectTo: string;
  error: {
    status: number;
    code: string;
    message: string;
  };
};

export type SocialFlowThreadsCallbackResult =
  | SocialFlowThreadsCallbackSuccess
  | SocialFlowThreadsCallbackFailure;

export class ThreadsIntegrationError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown> | null;

  constructor(message: string, options: { code: string; details?: Record<string, unknown> | null }) {
    super(message);
    this.name = "ThreadsIntegrationError";
    this.code = options.code;
    this.details = options.details ?? null;
  }
}
