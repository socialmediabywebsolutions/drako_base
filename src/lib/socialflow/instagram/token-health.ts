import { decryptToken, encryptToken } from "@/lib/socialflow/token-encryption";
import { refreshLongLivedInstagramToken } from "./oauth";
import { seedFeedItems } from "@/lib/socialflow/intelligence/repository";

const REFRESH_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // 15 días

export const TOKEN_INVALID_ALERT_SOURCE = "token-health-agent";
const TOKEN_INVALID_ALERT_TITLE = "Tu cuenta de Instagram necesita reconexión";

// Llamado desde dos sitios: aquí mismo cuando falla la renovación proactiva, y desde
// live-publishing.ts cuando una publicación falla en vivo con error 2021 (token ya
// caducado del todo, sin margen de 15 días que renovar). seedFeedItems ya es idempotente
// por (tenantId, saasId, source, title) — deterministic id, ver intelligence/repository.ts
// — así que llamarlo varias veces no duplica la card, solo la actualiza.
export async function seedTokenInvalidAlert(tenantId: string, saasId: string): Promise<void> {
  await seedFeedItems(
    tenantId,
    [
      {
        type: "alert",
        priority: "high",
        title: TOKEN_INVALID_ALERT_TITLE,
        description:
          "Tu token de acceso expiró. Ve a Conectar redes para reconectar tu cuenta y que Socialcors pueda seguir publicando.",
        actionLabel: "Reconectar cuenta",
        actionHref: "/socialflow/settings/accounts",
        source: TOKEN_INVALID_ALERT_SOURCE,
        network: "INSTAGRAM",
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
