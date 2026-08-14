import { env } from "@/lib/cf";
import { decryptToken, encryptToken } from "@/lib/socialflow/token-encryption";
import { refreshLinkedInAccessToken } from "@/lib/socialflow/linkedin/core";
import { seedFeedItems } from "@/lib/socialflow/intelligence/repository";

const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export const LINKEDIN_TOKEN_ALERT_SOURCE = "linkedin-token-health-agent";
const LINKEDIN_TOKEN_ALERT_TITLE = "Tu cuenta de LinkedIn necesita reconexión";

async function seedLinkedInTokenAlert(tenantId: string, saasId: string, description: string): Promise<void> {
  await seedFeedItems(
    tenantId,
    [
      {
        type: "alert",
        priority: "high",
        title: LINKEDIN_TOKEN_ALERT_TITLE,
        description,
        actionLabel: "Reconectar cuenta",
        actionHref: "/socialflow/redes",
        source: LINKEDIN_TOKEN_ALERT_SOURCE,
        network: "LINKEDIN",
      },
    ],
    saasId,
  ).catch((err) => {
    console.error("[LinkedInTokenHealth] seedLinkedInTokenAlert failed", err instanceof Error ? err.message : String(err));
  });
}

// Comprueba expiresAt guardado en auth_meta y renueva el access token de LinkedIn si
// quedan menos de 7 días — llamado desde checkAllLinkedInAccountTokens (más abajo),
// que corre para TODAS las cuentas LinkedIn CONNECTED_REAL, sin el gate de
// linkedin_cm_enabled (Paso 5): el token necesita revisarse tenga o no la cuenta
// Community Management activado. Nunca lanza: cualquier fallo queda en log; un fallo
// en una cuenta no debe impedir que el resto se procesen.
//
// Caso esperado hoy (sin aprobación MDP — Marketing Developer Platform, programa
// distinto de "Share on LinkedIn"): LinkedIn no incluye refresh_token en el
// intercambio inicial, así que authMeta.refreshToken estará ausente para todas las
// cuentas. Eso NO es un error — se loguea claro y se avisa al usuario en el
// Intelligence Feed para que reconecte manualmente antes de que el access token
// expire (60 días).
export async function checkAndRefreshLinkedInToken(
  db: D1Database,
  account: { id: string; tenantId: string; saasId: string },
  authMeta: Record<string, unknown>,
): Promise<void> {
  try {
    const expiresAt = typeof authMeta.expiresAt === "string" ? authMeta.expiresAt : null;
    const encryptedAccessToken = typeof authMeta.accessToken === "string" ? authMeta.accessToken : null;
    if (!expiresAt || !encryptedAccessToken) return;

    const expiresAtMs = new Date(expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs)) return;

    // Todavía le quedan más de 7 días — nada que hacer esta corrida.
    if (expiresAtMs - Date.now() > REFRESH_THRESHOLD_MS) return;

    const encryptedRefreshToken = typeof authMeta.refreshToken === "string" ? authMeta.refreshToken : null;
    if (!encryptedRefreshToken) {
      console.warn(
        `[LinkedInTokenHealth] Account ${account.id}: access token expiring (${expiresAt}) but no refresh_token stored — ` +
          `expected without LinkedIn MDP (Marketing Developer Platform) approval. Manual reconnection required.`,
      );
      await seedLinkedInTokenAlert(
        account.tenantId,
        account.saasId,
        "Tu token de LinkedIn expira pronto y no se puede renovar automáticamente. Ve a Mis Redes para reconectar tu cuenta.",
      );
      return;
    }

    const refreshToken = await decryptToken(encryptedRefreshToken);
    if (!refreshToken) return; // no se puede refrescar lo que no se puede leer; se reintenta en el próximo ciclo

    try {
      const refreshed = await refreshLinkedInAccessToken(refreshToken);
      const newEncryptedAccessToken = await encryptToken(refreshed.access_token);
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      // LinkedIn suele rotar el refresh token en cada uso — si no viene uno nuevo,
      // nos quedamos con el actual en vez de perderlo.
      const newEncryptedRefreshToken = refreshed.refresh_token
        ? await encryptToken(refreshed.refresh_token)
        : encryptedRefreshToken;
      const newRefreshTokenExpiresAt =
        typeof refreshed.refresh_token_expires_in === "number"
          ? new Date(Date.now() + refreshed.refresh_token_expires_in * 1000).toISOString()
          : (typeof authMeta.refreshTokenExpiresAt === "string" ? authMeta.refreshTokenExpiresAt : null);

      const updatedAuthMeta = {
        ...authMeta,
        accessToken: newEncryptedAccessToken,
        tokenType: refreshed.token_type ?? authMeta.tokenType ?? null,
        expiresIn: refreshed.expires_in,
        expiresAt: newExpiresAt,
        refreshToken: newEncryptedRefreshToken,
        refreshTokenExpiresAt: newRefreshTokenExpiresAt,
        scope: refreshed.scope ?? authMeta.scope ?? null,
        tokenInvalid: false,
      };

      await db
        .prepare(`UPDATE saas_social_accounts SET auth_meta = ?, updated_at = ? WHERE id = ?`)
        .bind(JSON.stringify(updatedAuthMeta), new Date().toISOString(), account.id)
        .run();

      console.log(`[LinkedInTokenHealth] Refreshed LinkedIn token for account ${account.id}, new expiry ${newExpiresAt}`);
    } catch (refreshError) {
      console.error(
        `[LinkedInTokenHealth] Refresh failed for account ${account.id}`,
        refreshError instanceof Error ? refreshError.message : String(refreshError),
      );

      const updatedAuthMeta = { ...authMeta, tokenInvalid: true };
      await db
        .prepare(`UPDATE saas_social_accounts SET auth_meta = ?, updated_at = ? WHERE id = ?`)
        .bind(JSON.stringify(updatedAuthMeta), new Date().toISOString(), account.id)
        .run()
        .catch((err) => {
          console.error(`[LinkedInTokenHealth] Failed to flag account ${account.id} as tokenInvalid`, err);
        });

      await seedLinkedInTokenAlert(
        account.tenantId,
        account.saasId,
        "No se pudo renovar tu token de LinkedIn. Ve a Mis Redes para reconectar tu cuenta.",
      );
    }
  } catch (error) {
    console.error(
      `[LinkedInTokenHealth] checkAndRefreshLinkedInToken unexpected failure for account ${account.id}`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

type LinkedInTokenHealthAccountRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  auth_meta: string | null;
};

// Recorre TODAS las cuentas LinkedIn CONNECTED_REAL (sin filtrar por
// linkedin_cm_enabled — a diferencia de processLinkedInMetrics en
// metrics-collector.ts, que sí lo hace) y comprueba/renueva el token de cada una.
// Llamado desde /api/cron/social/metrics, mismo cron 0 */4 * * * que ya usa
// Instagram para su propio check-and-refresh.
export async function checkAllLinkedInAccountTokens(): Promise<{ checked: number; errors: number }> {
  const db = env()?.SOCIAL_DB;
  if (!db) return { checked: 0, errors: 0 };

  const { results: accounts } = await db
    .prepare(
      `SELECT id, tenant_id, saas_id, auth_meta
       FROM saas_social_accounts
       WHERE provider = 'LINKEDIN' AND status = 'CONNECTED_REAL'
       LIMIT 50`,
    )
    .all<LinkedInTokenHealthAccountRow>();

  if (!accounts?.length) return { checked: 0, errors: 0 };

  let checked = 0;
  let errors = 0;

  for (const account of accounts) {
    try {
      const authMeta = account.auth_meta ? (JSON.parse(account.auth_meta) as Record<string, unknown>) : null;
      if (!authMeta) {
        errors++;
        continue;
      }

      await checkAndRefreshLinkedInToken(
        db,
        { id: account.id, tenantId: account.tenant_id, saasId: account.saas_id },
        authMeta,
      );
      checked++;
    } catch (error) {
      console.error(
        `[LinkedInTokenHealth] checkAllLinkedInAccountTokens failed for account ${account.id}`,
        error instanceof Error ? error.message : String(error),
      );
      errors++;
    }
  }

  return { checked, errors };
}
