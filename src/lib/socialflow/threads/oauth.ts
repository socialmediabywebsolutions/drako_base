// Threads OAuth flow — similar a Instagram/LinkedIn pero contra graph.threads.net
// Requiere la misma Meta App (INSTAGRAM_APP_ID) con el producto "Threads API" habilitado.
// El App Secret se configura como wrangler secret THREADS_APP_SECRET.

import { env } from "@/lib/cf";
import { getSession } from "@/lib/auth/session";
import { verifyAndConsumeOAuthState } from "@/lib/socialflow/oauth/state";
import { exchangeThreadsCodeForLongLivedToken, fetchThreadsUserProfile } from "@/lib/socialflow/threads/core";
import { persistSocialFlowThreadsConnection } from "@/lib/socialflow/threads/repository";
import {
  SOCIALFLOW_THREADS_AUTH_BASE,
  SOCIALFLOW_THREADS_CALLBACK_PATH,
  SOCIALFLOW_THREADS_SCOPES,
  SOCIALFLOW_THREADS_SETTINGS_PATH,
  ThreadsIntegrationError,
  type SocialFlowThreadsCallbackResult,
} from "@/lib/socialflow/threads/types";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers de configuración
// ---------------------------------------------------------------------------

function getThreadsAppId(): string {
  // Reutiliza el App ID de Meta (mismo para Instagram y Threads)
  const fromProcess = process.env.INSTAGRAM_APP_ID?.trim() || process.env.THREADS_APP_ID?.trim() || "";
  if (fromProcess) return fromProcess;
  const bindings = env() as Record<string, unknown> | null;
  const fromBinding = typeof bindings?.INSTAGRAM_APP_ID === "string" ? bindings.INSTAGRAM_APP_ID.trim() : "";
  if (fromBinding) return fromBinding;
  throw new ThreadsIntegrationError("INSTAGRAM_APP_ID / THREADS_APP_ID not configured", {
    code: "THREADS_ENV_APP_ID_MISSING",
  });
}

function getThreadsAppSecret(): string {
  const fromProcess = process.env.THREADS_APP_SECRET?.trim() || process.env.INSTAGRAM_APP_SECRET?.trim() || "";
  if (fromProcess) return fromProcess;
  const bindings = env() as Record<string, unknown> | null;
  const fromBinding =
    typeof bindings?.THREADS_APP_SECRET === "string" ? bindings.THREADS_APP_SECRET.trim() :
    typeof bindings?.INSTAGRAM_APP_SECRET === "string" ? bindings.INSTAGRAM_APP_SECRET.trim() : "";
  if (fromBinding) return fromBinding;
  throw new ThreadsIntegrationError("THREADS_APP_SECRET (o INSTAGRAM_APP_SECRET) not configured", {
    code: "THREADS_ENV_SECRET_MISSING",
  });
}

function buildCallbackUrl(origin: string): string {
  return `${origin}${SOCIALFLOW_THREADS_CALLBACK_PATH}`;
}

// ---------------------------------------------------------------------------
// Iniciar OAuth (connect)
// ---------------------------------------------------------------------------

export async function startThreadsOAuth(
  request: NextRequest,
  { tenantId, saasId }: { tenantId: string; saasId: string },
): Promise<{ authorizationUrl: string }> {
  const { createOAuthState } = await import("@/lib/socialflow/oauth/state");
  const state = await createOAuthState({ tenantId, saasId });

  const appId = getThreadsAppId();
  const origin = new URL(request.url).origin;
  const redirectUri = buildCallbackUrl(origin);

  const url = new URL(SOCIALFLOW_THREADS_AUTH_BASE);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SOCIALFLOW_THREADS_SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  return { authorizationUrl: url.toString() };
}

// ---------------------------------------------------------------------------
// Callback OAuth
// ---------------------------------------------------------------------------

export async function handleThreadsCallback(
  request: NextRequest,
): Promise<SocialFlowThreadsCallbackResult> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const redirectTo = SOCIALFLOW_THREADS_SETTINGS_PATH;

  // El usuario denegó el acceso
  if (error) {
    return {
      ok: false,
      tenantId: null,
      saasId: null,
      redirectTo,
      error: {
        status: 400,
        code: "THREADS_USER_DENIED",
        message: errorDescription ?? error,
      },
    };
  }

  if (!code || !state) {
    return {
      ok: false,
      tenantId: null,
      saasId: null,
      redirectTo,
      error: {
        status: 400,
        code: "THREADS_CODE_MISSING",
        message: "No authorization code returned by Threads.",
      },
    };
  }

  // Verificar y consumir el state nonce
  let oauthContext: { tenantId: string; saasId: string };
  try {
    oauthContext = await verifyAndConsumeOAuthState(state);
  } catch {
    return {
      ok: false,
      tenantId: null,
      saasId: null,
      redirectTo,
      error: {
        status: 400,
        code: "THREADS_STATE_INVALID",
        message: "Invalid or expired OAuth state. Please try connecting again.",
      },
    };
  }

  // Verificar que hay sesión activa
  const session = await getSession(request);
  if (!session || session.tenantId !== oauthContext.tenantId) {
    return {
      ok: false,
      tenantId: oauthContext.tenantId,
      saasId: oauthContext.saasId,
      redirectTo,
      error: {
        status: 401,
        code: "THREADS_SESSION_MISMATCH",
        message: "Session mismatch. Please log in again and retry the connection.",
      },
    };
  }

  try {
    const origin = new URL(request.url).origin;
    const redirectUri = buildCallbackUrl(origin);
    const appId = getThreadsAppId();
    const appSecret = getThreadsAppSecret();

    // Intercambiar código por token de larga duración
    const token = await exchangeThreadsCodeForLongLivedToken({
      code,
      redirectUri,
      clientId: appId,
      clientSecret: appSecret,
    });

    // Obtener perfil del usuario
    const profile = await fetchThreadsUserProfile(token.access_token);

    // Persistir la conexión
    const grantedScope = SOCIALFLOW_THREADS_SCOPES;
    const { account } = await persistSocialFlowThreadsConnection({
      tenantId: oauthContext.tenantId,
      saasId: oauthContext.saasId,
      token,
      profile,
      grantedScope,
    });

    return {
      ok: true,
      tenantId: oauthContext.tenantId,
      saasId: oauthContext.saasId,
      redirectTo: `${SOCIALFLOW_THREADS_SETTINGS_PATH}?saasId=${encodeURIComponent(oauthContext.saasId)}&threads_connected=1`,
      userId: profile.id,
      username: profile.username,
      accountId: account.id,
    };
  } catch (err) {
    const code = err instanceof ThreadsIntegrationError ? err.code : "THREADS_CALLBACK_FAILED";
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      tenantId: oauthContext.tenantId,
      saasId: oauthContext.saasId,
      redirectTo,
      error: { status: 500, code, message },
    };
  }
}
