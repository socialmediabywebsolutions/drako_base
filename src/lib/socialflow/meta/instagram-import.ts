import { decryptToken } from "@/lib/socialflow/token-encryption";
import { resolveMetaApiBase, type InstagramMediaItem } from "@/lib/socialflow/meta/core";

// Los posts publicados directamente en Instagram (fuera de Socialcors) no existían en
// saas_social_posts, así que los agentes del Cerebro — que aprenden de los posts
// publicados del tenant — ignoraban a cualquier cliente que no publicara desde la app.
// Se importan como creation_mode='IMPORTED', status POSTED; a partir de ahí el recolector
// de métricas los empareja por external_post_id como a cualquier otro post.

// Un post publicado por la propia app puede aparecer en /media unos segundos antes de que
// markAsPosted() guarde su external_post_id. Si se importara en esa ventana, el UPDATE
// posterior del post nativo chocaría con el índice único (tenant_id, external_post_id) —
// se dejan fuera los posts de los últimos 30 min; el siguiente ciclo ya los encuentra
// emparejados.
const RECENT_PUBLISH_GRACE_MS = 30 * 60 * 1000;
const TITLE_MAX_LENGTH = 80;

export type InstagramImportAccount = {
  id: string;
  tenant_id: string;
  saas_id: string;
  auth_meta: string | null;
};

export type InstagramCredentials = { pageToken: string; igUserId: string; apiBase: string };

export async function resolveInstagramCredentials(authMetaJson: string | null): Promise<InstagramCredentials | null> {
  const authMeta = authMetaJson ? (JSON.parse(authMetaJson) as Record<string, unknown>) : null;
  const encryptedToken = typeof authMeta?.accessToken === "string" ? authMeta.accessToken : null;
  const igUserId = typeof authMeta?.igUserId === "string" ? authMeta.igUserId : null;
  if (!encryptedToken || !igUserId) return null;
  const pageToken = await decryptToken(encryptedToken);
  if (!pageToken) return null;
  const authType = typeof authMeta?.authType === "string" ? authMeta.authType : null;
  return { pageToken, igUserId, apiBase: resolveMetaApiBase(authType) };
}

// media_product_type distingue Reels y Stories; media_type distingue carruseles. El
// resto (IMAGE, VIDEO de feed) es FEED.
function contentTypeFor(item: InstagramMediaItem): "REEL" | "STORY" | "CAROUSEL" | "FEED" {
  if (item.mediaProductType === "REELS") return "REEL";
  if (item.mediaProductType === "STORY") return "STORY";
  if (item.mediaType === "CAROUSEL_ALBUM") return "CAROUSEL";
  return "FEED";
}

function titleFor(caption: string): string {
  const firstLine = caption.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  if (!firstLine) return "Post de Instagram";
  return firstLine.length > TITLE_MAX_LENGTH ? `${firstLine.slice(0, TITLE_MAX_LENGTH - 1)}…` : firstLine;
}

async function findInstagramChannelId(db: D1Database, tenantId: string, saasId: string): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT id FROM saas_social_channels
       WHERE tenant_id = ? AND saas_id = ? AND provider = 'INSTAGRAM' AND status = 'ACTIVE'
       ORDER BY created_at ASC LIMIT 1`,
    )
    .bind(tenantId, saasId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

// Crea en saas_social_posts los media de Instagram que aún no existen para el tenant.
// INSERT OR IGNORE sobre el índice único (tenant_id, external_post_id): los ya existentes
// (nativos o importados antes) se saltan solos, así que es seguro reimportar. Devuelve
// cuántos se crearon de verdad.
export async function importInstagramMediaItems(
  db: D1Database,
  account: Pick<InstagramImportAccount, "tenant_id" | "saas_id">,
  items: InstagramMediaItem[],
): Promise<{ imported: number; skippedRecent: number }> {
  const cutoff = Date.now() - RECENT_PUBLISH_GRACE_MS;
  const eligible = items.filter((item) => Date.parse(item.timestamp) <= cutoff);
  const skippedRecent = items.length - eligible.length;
  if (!eligible.length) return { imported: 0, skippedRecent };

  const channelId = await findInstagramChannelId(db, account.tenant_id, account.saas_id);
  const nowIso = new Date().toISOString();

  let imported = 0;
  for (const item of eligible) {
    const caption = item.caption ?? "";
    const postedAt = new Date(item.timestamp).toISOString();
    const metadata = JSON.stringify({ importedFrom: "instagram", permalink: item.permalink, importedAt: nowIso });
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO saas_social_posts
           (id, tenant_id, saas_id, campaign_id, provider, content_type, title, body, image_hint, status,
            scheduled_at, posted_at, external_post_id, metadata, created_at, updated_at, channel_id, creation_mode)
         VALUES (?, ?, ?, NULL, 'INSTAGRAM', ?, ?, ?, NULL, 'POSTED', ?, ?, ?, ?, ?, ?, ?, 'IMPORTED')`,
      )
      .bind(
        crypto.randomUUID(),
        account.tenant_id,
        account.saas_id,
        contentTypeFor(item),
        titleFor(caption),
        caption,
        postedAt,
        postedAt,
        item.id,
        metadata,
        nowIso,
        nowIso,
        channelId,
      )
      .run();
    imported += (result.meta as { changes?: number } | undefined)?.changes ?? 0;
  }
  return { imported, skippedRecent };
}
