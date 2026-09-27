import { decryptToken, encryptToken } from "@/lib/socialflow/token-encryption";
import { refreshLongLivedInstagramToken } from "./oauth";
import { seedFeedItems } from "@/lib/socialflow/intelligence/repository";
import { resolveMetaApiBase } from "@/lib/socialflow/meta/core";

const REFRESH_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // 15 días

export const TOKEN_INVALID_ALERT_SOURCE = "token-health-agent";
const TOKEN_INVALID_ALERT_TITLE = "Tu cuenta de Instagram necesita reconexión";
const FACEBOOK_TOKEN_INVALID_ALERT_TITLE = "Tu Página de Facebook necesita reconexión";
// Códigos de la Graph API que significan token inválido/revocado (OAuthException 190 y
// permisos retirados 102/10/200) — cualquier otro error (red, 5xx, rate limit) no marca
// la cuenta, se reintenta en el siguiente ciclo.
const FACEBOOK_INVALID_TOKEN_CODES = new Set([190, 102, 10, 200]);

// Llamado desde dos sitios: aquí mismo cuando falla la renovación proactiva, y desde
// live-publishing.ts cuando una publicación falla en vivo con error 2021 (token ya
// caducado del todo, sin margen de 15 días que renovar). seedFeedItems ya es idempotente
// por (tenantId, saasId, source, title) — deterministic id, ver intelligence/repository.ts
// — así que llamarlo varias veces no duplica la card, solo la actualiza.
export async function seedTokenInvalidAlert(
  tenantId: string,
  saasId: string,
  network: "INSTAGRAM" | "FACEBOOK_PAGE" = "INSTAGRAM",
): Promise<void> {
  const isFacebook = network === "FACEBOOK_PAGE";
  await seedFeedItems(
    tenantId,
    [
      {
        type: "alert",
        priority: "high",
        title: isFacebook ? FACEBOOK_TOKEN_INVALID_ALERT_TITLE : TOKEN_INVALID_ALERT_TITLE,
        description: isFacebook
          ? "Facebook ha invalidado el acceso a tu Página (contraseña cambiada o permisos retirados). Reconéctala en Mis Redes para que Socialcors pueda seguir publicando."
          : "Tu token de acceso expiró. Ve a Conectar redes para reconectar tu cuenta y que Socialcors pueda seguir publicando.",
        actionLabel: "Reconectar cuenta",
        actionHref: isFacebook ? "/socialflow/redes" : "/socialflow/settings/accounts",
        source: TOKEN_INVALID_ALERT_SOURCE,
        network,
      },
    ],
    saasId,
  ).catch((err) => {
    console.error("[TokenHealth] seedTokenInvalidAlert failed", err instanceof Error ? err.message : String(err));
  });
}

// Comprueba expiresAt guardado en auth_meta y renueva el Long-Lived Token de Instagram
// si quedan menos de 15 días — llamado desde el cron de métricas (0 */4 * * *) después
// de fetchear métricas por cuenta. Nunca lanza: cualquier fallo (parseo, decrypt,
// refresh, escritura) queda en log; si el refresh en sí falla, además marca
// tokenInvalid en auth_meta y crea la alerta en el Intelligence Feed. Nunca tumba el
// cron de métricas que lo llama — un fallo aquí no debe impedir que el resto de cuentas
// se procesen.
export async function checkAndRefreshInstagramToken(
  db: D1Database,
  account: { id: string; tenantId: string; saasId: string },
  authMeta: Record<string, unknown>,
): Promise<void> {
  try {
    const expiresAt = typeof authMeta.expiresAt === "string" ? authMeta.expiresAt : null;
    const encryptedToken = typeof authMeta.accessToken === "string" ? authMeta.accessToken : null;
    if (!expiresAt || !encryptedToken) return;

    const expiresAtMs = new Date(expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs)) return;

    // Todavía le queda más de 15 días — nada que hacer esta corrida.
    if (expiresAtMs - Date.now() > REFRESH_THRESHOLD_MS) return;

    const currentToken = await decryptToken(encryptedToken);
    if (!currentToken) return; // no se puede refrescar lo que no se puede leer; se reintenta en el próximo ciclo

    try {
      const refreshed = await refreshLongLivedInstagramToken(currentToken);
      const newEncryptedToken = await encryptToken(refreshed.access_token);
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      const updatedAuthMeta = {
        ...authMeta,
        accessToken: newEncryptedToken,
        tokenType: refreshed.token_type,
        expiresIn: refreshed.expires_in,
        expiresAt: newExpiresAt,
        tokenInvalid: false,
      };

      await db
        .prepare(`UPDATE saas_social_accounts SET auth_meta = ?, updated_at = ? WHERE id = ?`)
        .bind(JSON.stringify(updatedAuthMeta), new Date().toISOString(), account.id)
        .run();

      console.log(`[TokenHealth] Refreshed Instagram token for account ${account.id}, new expiry ${newExpiresAt}`);
    } catch (refreshError) {
      console.error(
        `[TokenHealth] Refresh failed for account ${account.id}`,
        refreshError instanceof Error ? refreshError.message : String(refreshError),
      );

      const updatedAuthMeta = { ...authMeta, tokenInvalid: true };
      await db
        .prepare(`UPDATE saas_social_accounts SET auth_meta = ?, updated_at = ? WHERE id = ?`)
        .bind(JSON.stringify(updatedAuthMeta), new Date().toISOString(), account.id)
        .run()
        .catch((err) => {
          console.error(`[TokenHealth] Failed to flag account ${account.id} as tokenInvalid`, err);
        });

      await seedTokenInvalidAlert(account.tenantId, account.saasId);
    }
  } catch (error) {
    console.error(
      `[TokenHealth] checkAndRefreshInstagramToken unexpected failure for account ${account.id}`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Token de Página de Facebook: al venir de un token de usuario de larga duración, NO
// caduca por tiempo ni tiene endpoint de renovación (a diferencia del de Instagram de
// arriba). Lo que sí puede pasar es que Facebook lo invalide (cambio de contraseña,
// permisos retirados, Página desvinculada). Por eso aquí se VALIDA con una llamada barata
// a /{page-id} y, si Facebook responde con un código de token inválido, se marca
// tokenInvalid y se crea la alerta de reconexión. Si vuelve a ser válido, se limpia el
// flag. Nunca lanza — mismo contrato que checkAndRefreshInstagramToken.
export async function checkFacebookPageToken(
  db: D1Database,
  account: { id: string; tenantId: string; saasId: string },
  authMeta: Record<string, unknown>,
): Promise<{ valid: boolean | null }> {
  try {
    const encryptedToken = typeof authMeta.accessToken === "string" ? authMeta.accessToken : null;
    const pageId = typeof authMeta.pageId === "string" ? authMeta.pageId : null;
    if (!encryptedToken || !pageId) return { valid: null };

    const pageToken = await decryptToken(encryptedToken);
    if (!pageToken) return { valid: null };

    const url = new URL(`${resolveMetaApiBase(null)}/${pageId}`);
    url.searchParams.set("fields", "id");
    url.searchParams.set("access_token", pageToken);
    const res = await fetch(url.toString(), { method: "GET" });
    const payload = (await res.json().catch(() => null)) as { error?: { code?: number } } | null;

    const errorCode = typeof payload?.error?.code === "number" ? payload.error.code : null;
    const invalid = !res.ok && errorCode !== null && FACEBOOK_INVALID_TOKEN_CODES.has(errorCode);
    if (!res.ok && !invalid) return { valid: null }; // error transitorio — no se toca nada

    const wasInvalid = authMeta.tokenInvalid === true;
    if (invalid !== wasInvalid) {
      await db
        .prepare(`UPDATE saas_social_accounts SET auth_meta = ?, updated_at = ? WHERE id = ?`)
        .bind(JSON.stringify({ ...authMeta, tokenInvalid: invalid, lastTokenCheckAt: new Date().toISOString() }), new Date().toISOString(), account.id)
        .run();
    }
    if (invalid) {
      console.error(`[TokenHealth] Facebook Page token invalid for account ${account.id} (code ${errorCode})`);
      await seedTokenInvalidAlert(account.tenantId, account.saasId, "FACEBOOK_PAGE");
    }
    return { valid: !invalid };
  } catch (error) {
    console.error(
      `[TokenHealth] checkFacebookPageToken unexpected failure for account ${account.id}`,
      error instanceof Error ? error.message : String(error),
    );
    return { valid: null };
  }
}
