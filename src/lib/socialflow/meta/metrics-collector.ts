import { env } from "@/lib/cf";
import { decryptToken } from "@/lib/socialflow/token-encryption";
import { resolveSocialContext, upsertSaasSocialMetrics, type SocialContext } from "@/lib/socialflow/repository";
import { checkAndRefreshInstagramToken } from "@/lib/socialflow/instagram/token-health";
import {
  fetchInstagramAccountInsights,
  fetchInstagramRecentMedia,
  fetchInstagramMediaInsights,
  fetchInstagramMediaEngagement,
  resolveMetaApiBase,
  MetaIntegrationError,
} from "@/lib/socialflow/meta/core";

// So Cloudflare Logs show exactly which endpoint failed for which account type —
// needed to confirm (or rule out) which Graph API calls actually reject MEDIA_CREATOR
// accounts, since that can't be verified from this sandbox (no egress to Graph API).
function logMetaMetricsError(endpoint: string, accountId: string, accountType: string | null, error: unknown, extra?: string) {
  const suffix = extra ? ` (${extra})` : "";
  if (error instanceof MetaIntegrationError) {
    console.error(`[MetricsCron] endpoint=${endpoint} account=${accountId} accountType=${accountType ?? "unknown"}${suffix} code=${error.code} message=${error.message} details=${JSON.stringify(error.details)}`);
  } else {
    console.error(`[MetricsCron] endpoint=${endpoint} account=${accountId} accountType=${accountType ?? "unknown"}${suffix} error=${error instanceof Error ? error.message : String(error)}`);
  }
}

type DeferredPostRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  external_post_id: string;
  content_type: string;
};

type DeferredAccountRow = {
  auth_meta: string | null;
};

export async function processDeferredInstagramMetrics(): Promise<{ processed: number; errors: number }> {
  const bindings = env();
  const socialDb = bindings?.SOCIAL_DB;
  if (!socialDb) return { processed: 0, errors: 0 };

  // Posts published between 15 min and 2 h ago with no metrics row yet
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { results: posts } = await socialDb
    .prepare(
      `SELECT p.id, p.tenant_id, p.saas_id, p.external_post_id, p.content_type
       FROM saas_social_posts p
       WHERE p.provider = 'INSTAGRAM'
         AND p.status IN ('POSTED', 'PUBLISHED')
         AND p.external_post_id IS NOT NULL
         AND p.posted_at IS NOT NULL
         AND datetime(p.posted_at) BETWEEN datetime(?) AND datetime(?)
         AND NOT EXISTS (
           SELECT 1 FROM saas_social_metrics m
           WHERE m.post_id = p.id AND m.tenant_id = p.tenant_id
         )
       LIMIT 10`,
    )
    .bind(twoHoursAgo, fifteenMinAgo)
    .all<DeferredPostRow>();

  if (!posts?.length) return { processed: 0, errors: 0 };

  let processed = 0;
  let errors = 0;

  for (const post of posts) {
    try {
      const { results: accountRows } = await socialDb
        .prepare(
          `SELECT auth_meta FROM saas_social_accounts
           WHERE tenant_id = ? AND saas_id = ? AND provider = 'INSTAGRAM' AND status = 'CONNECTED_REAL'
           ORDER BY is_primary DESC LIMIT 1`,
        )
        .bind(post.tenant_id, post.saas_id)
        .all<DeferredAccountRow>();

      const accountRow = accountRows?.[0];
      if (!accountRow) { errors++; continue; }

      const authMeta = accountRow.auth_meta
        ? (JSON.parse(accountRow.auth_meta) as Record<string, unknown>)
        : null;
      const encryptedToken = typeof authMeta?.accessToken === "string" ? authMeta.accessToken : null;
      const igUserId = typeof authMeta?.igUserId === "string" ? authMeta.igUserId : null;
      const authType = typeof authMeta?.authType === "string" ? authMeta.authType : null;
      if (!encryptedToken || !igUserId) { errors++; continue; }

      const pageToken = await decryptToken(encryptedToken);
      if (!pageToken) { errors++; continue; }

      const apiBase = resolveMetaApiBase(authType);
      const isReel = post.content_type === "REEL";
      const [recentMedia, mediaInsights] = await Promise.all([
        fetchInstagramRecentMedia(pageToken, igUserId, apiBase).catch(() => []),
        fetchInstagramMediaInsights(pageToken, post.external_post_id, apiBase, isReel),
      ]);

      const mediaItem = recentMedia.find((m) => m.id === post.external_post_id);
      const ctx = await resolveSocialContext({ tenantId: post.tenant_id, saasId: post.saas_id });

      await upsertSaasSocialMetrics(ctx, {
        postId: post.id,
        provider: "INSTAGRAM",
        impressions: mediaInsights.impressions,
        likes: mediaItem?.likeCount ?? 0,
        comments: mediaItem?.commentsCount ?? 0,
        shares: mediaInsights.shares,
        clicks: 0,
        leadsGenerated: 0,
        capturedAt: new Date().toISOString(),
        metadata: {
          type: "media_deferred",
          mediaId: post.external_post_id,
          reach: mediaInsights.reach,
          saved: mediaInsights.saved,
          ...(isReel
            ? { videoViews: mediaInsights.videoViews, plays: mediaInsights.plays, avgWatchTimeMs: mediaInsights.avgWatchTimeMs }
            : {}),
        },
      });

      processed++;
    } catch (err) {
      console.warn(`[MetricsDeferred] Post ${post.id} error:`, err instanceof Error ? err.message : String(err));
      errors++;
    }
  }

  console.log(`[MetricsDeferred] Deferred metrics: ${processed} processed, ${errors} errors.`);
  return { processed, errors };
}

type AccountRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  auth_meta: string | null;
};

type MediaPostRow = {
  id: string;
  saas_id: string;
  content_type: string;
};

type UncapturedPostRow = {
  id: string;
  saas_id: string;
  external_post_id: string;
  content_type: string;
};

export type InstagramMetricsResult = {
  processed: number;
  errors: number;
  mediaProcessed: number;
};

export async function processInstagramMetrics(): Promise<InstagramMetricsResult> {
  const bindings = env();
  const socialDb = bindings?.SOCIAL_DB;
  if (!socialDb) throw new Error("SOCIAL_DB not configured");

  const { results: accounts } = await socialDb
    .prepare(
      `SELECT id, tenant_id, saas_id, auth_meta
       FROM saas_social_accounts
       WHERE provider = 'INSTAGRAM' AND status = 'CONNECTED_REAL'
       LIMIT 50`,
    )
    .all<AccountRow>();

  if (!accounts?.length) {
    return { processed: 0, errors: 0, mediaProcessed: 0 };
  }

  let processed = 0;
  let errors = 0;
  let mediaProcessed = 0;

  for (const account of accounts) {
    let accountType: string | null = null;
    try {
      const authMeta =
        account.auth_meta ? (JSON.parse(account.auth_meta) as Record<string, unknown>) : null;
      const encryptedToken =
        typeof authMeta?.accessToken === "string" ? authMeta.accessToken : null;
      const igUserId =
        typeof authMeta?.igUserId === "string" ? authMeta.igUserId : null;
      const authType =
        typeof authMeta?.authType === "string" ? authMeta.authType : null;
      accountType =
        typeof authMeta?.accountType === "string" ? authMeta.accountType : null;
      const isCreator = accountType === "MEDIA_CREATOR";

      if (!encryptedToken || !igUserId) {
        console.warn(`[MetricsCron] Account ${account.id}: missing token or igUserId`);
        errors++;
        continue;
      }

      const pageToken = await decryptToken(encryptedToken);
      if (!pageToken) {
        console.warn(`[MetricsCron] Account ${account.id}: decryption returned null`);
        errors++;
        continue;
      }

      const apiBase = resolveMetaApiBase(authType);
      const ctx = await resolveSocialContext({
        tenantId: account.tenant_id,
        saasId: account.saas_id,
      });

      let insights;
      try {
        insights = await fetchInstagramAccountInsights(pageToken, igUserId, apiBase, accountType);
      } catch (accountInsightsError) {
        logMetaMetricsError("account_insights", account.id, accountType, accountInsightsError);
        throw accountInsightsError;
      }

      // For Business/legacy accounts, impressions/reach come straight from account
      // insights and are written immediately, as before. For MEDIA_CREATOR, impressions
      // and reach are 0 here by design (fetchInstagramAccountInsights skipped that call)
      // — the account-level row is written further down instead, once the per-media loop
      // has summed real numbers from each post's own insights.
      if (!isCreator) {
        await upsertSaasSocialMetrics(ctx, {
          postId: `account:${account.id}`,
          provider: "INSTAGRAM",
          impressions: insights.impressions,
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
          leadsGenerated: 0,
          capturedAt: insights.capturedAt,
          metadata: {
            type: "account",
            accountId: account.id,
            igUserId,
            followersCount: insights.followersCount,
            reach: insights.reach,
            reachSource: "account_insights",
          },
        });
      }

      // Per-media insights — only for posts SocialFlow published (have externalPostId match)
      const media = await fetchInstagramRecentMedia(pageToken, igUserId, apiBase).catch((recentMediaError) => {
        logMetaMetricsError("recent_media", account.id, accountType, recentMediaError);
        return [];
      });

      let creatorReachSum = 0;
      let creatorImpressionsSum = 0;
      const matchedExternalIds = new Set<string>();
      const contextBySaasId = new Map<string, SocialContext>([[account.saas_id, ctx]]);

      for (const item of media.slice(0, 10)) {
        try {
          const { results: matchingPosts } = await socialDb
            .prepare(
              `SELECT id, saas_id, content_type FROM saas_social_posts
               WHERE tenant_id = ? AND external_post_id = ? LIMIT 1`,
            )
            .bind(account.tenant_id, item.id)
            .all<MediaPostRow>();

          if (!matchingPosts?.length) continue;
          matchedExternalIds.add(item.id);

          const matchingPost = matchingPosts[0];
          const isMediaReel = matchingPost.content_type === "REEL";
          const mediaInsights = await fetchInstagramMediaInsights(pageToken, item.id, apiBase, isMediaReel);
          let mediaCtx = contextBySaasId.get(matchingPost.saas_id);
          if (!mediaCtx) {
            mediaCtx = await resolveSocialContext({ tenantId: account.tenant_id, saasId: matchingPost.saas_id });
            contextBySaasId.set(matchingPost.saas_id, mediaCtx);
          }

          if (isCreator) {
            creatorReachSum += mediaInsights.reach;
            creatorImpressionsSum += mediaInsights.impressions;
          }

          await upsertSaasSocialMetrics(mediaCtx, {
            postId: matchingPost.id,
            provider: "INSTAGRAM",
            impressions: mediaInsights.impressions,
            likes: item.likeCount,
            comments: item.commentsCount,
            shares: mediaInsights.shares,
            clicks: 0,
            leadsGenerated: 0,
            capturedAt: new Date().toISOString(),
            metadata: {
              type: "media",
              mediaId: item.id,
              reach: mediaInsights.reach,
              saved: mediaInsights.saved,
              timestamp: item.timestamp,
              ...(isMediaReel
                ? { videoViews: mediaInsights.videoViews, plays: mediaInsights.plays, avgWatchTimeMs: mediaInsights.avgWatchTimeMs }
                : {}),
            },
          });

          mediaProcessed++;
        } catch (mediaError) {
          logMetaMetricsError("media_insights", account.id, accountType, mediaError, item.id);
        }
      }

      // Backfill — posts con external_post_id real que /media no devolvió en este ciclo
      // (fuera del top-25 más reciente, o Stories, que ese edge nunca incluye). Sin esto,
      // esos posts nunca reciben fila en saas_social_metrics porque el matching de arriba
      // depende enteramente de que el post siga en fetchInstagramRecentMedia. LEFT JOIN en
      // vez de NOT EXISTS correlacionado — una sola query no correlacionada; no filtra por
      // saas_id (columna se trae en el SELECT) para cubrir el mismo caso cross-saas_id que
      // el loop de arriba, sin necesitar una query extra por post. Ventana de 30 días
      // (coincide con dashboard/Insights) y refresco cada 4h (misma cadencia que las
      // cuentas), acotado a 15 posts por cuenta por corrida del cron.
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { results: uncapturedPosts } = await socialDb
        .prepare(
          `SELECT p.id as id, p.saas_id as saas_id, p.external_post_id as external_post_id, p.content_type as content_type
           FROM saas_social_posts p
           LEFT JOIN saas_social_metrics m ON m.post_id = p.id AND m.tenant_id = p.tenant_id
           WHERE p.tenant_id = ? AND p.provider = 'INSTAGRAM'
             AND p.status IN ('POSTED', 'PUBLISHED')
             AND p.external_post_id IS NOT NULL
             AND p.posted_at >= ?
           GROUP BY p.id
           HAVING MAX(m.captured_at) IS NULL OR MAX(m.captured_at) < ?
           LIMIT 15`,
        )
        .bind(account.tenant_id, thirtyDaysAgo, fourHoursAgo)
        .all<UncapturedPostRow>();

      for (const post of uncapturedPosts ?? []) {
        if (matchedExternalIds.has(post.external_post_id)) continue;
        try {
          const isBackfillReel = post.content_type === "REEL";
          const [mediaInsights, engagement] = await Promise.all([
            fetchInstagramMediaInsights(pageToken, post.external_post_id, apiBase, isBackfillReel),
            fetchInstagramMediaEngagement(pageToken, post.external_post_id, apiBase),
          ]);

          let backfillCtx = contextBySaasId.get(post.saas_id);
          if (!backfillCtx) {
            backfillCtx = await resolveSocialContext({ tenantId: account.tenant_id, saasId: post.saas_id });
            contextBySaasId.set(post.saas_id, backfillCtx);
          }

          if (isCreator) {
            creatorReachSum += mediaInsights.reach;
            creatorImpressionsSum += mediaInsights.impressions;
          }

          await upsertSaasSocialMetrics(backfillCtx, {
            postId: post.id,
            provider: "INSTAGRAM",
            impressions: mediaInsights.impressions,
            likes: engagement.likeCount,
            comments: engagement.commentsCount,
            shares: mediaInsights.shares,
            clicks: 0,
            leadsGenerated: 0,
            capturedAt: new Date().toISOString(),
            metadata: {
              type: "media_backfill",
              mediaId: post.external_post_id,
              reach: mediaInsights.reach,
              saved: mediaInsights.saved,
              ...(isBackfillReel
                ? { videoViews: mediaInsights.videoViews, plays: mediaInsights.plays, avgWatchTimeMs: mediaInsights.avgWatchTimeMs }
                : {}),
            },
          });

          mediaProcessed++;
        } catch (backfillError) {
          logMetaMetricsError("media_insights_backfill", account.id, accountType, backfillError, post.external_post_id);
        }
      }

      if (isCreator) {
        await upsertSaasSocialMetrics(ctx, {
          postId: `account:${account.id}`,
          provider: "INSTAGRAM",
          impressions: creatorImpressionsSum,
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
          leadsGenerated: 0,
          capturedAt: new Date().toISOString(),
          metadata: {
            type: "account",
            accountId: account.id,
            igUserId,
            followersCount: insights.followersCount,
            reach: creatorReachSum,
            reachSource: "media_insights_sum",
          },
        });
      }

      processed++;

      // Renovación proactiva del Long-Lived Token (60 días) — comprueba expiresAt y
      // renueva si quedan <15 días. Nunca lanza (ver checkAndRefreshInstagramToken),
      // así que un fallo aquí no puede tumbar el resto del cron de métricas.
      if (authMeta) {
        await checkAndRefreshInstagramToken(socialDb, { id: account.id, tenantId: account.tenant_id, saasId: account.saas_id }, authMeta);
      }
    } catch (error) {
      logMetaMetricsError("account_processing", account.id, accountType, error);
      errors++;
    }
  }

  return { processed, errors, mediaProcessed };
}
