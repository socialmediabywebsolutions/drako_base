import { env } from "@/lib/cf";
import { decryptToken } from "@/lib/socialflow/token-encryption";
import { resolveSocialContext, upsertSaasSocialMetrics } from "@/lib/socialflow/repository";
import {
  fetchInstagramAccountInsights,
  fetchInstagramRecentMedia,
  fetchInstagramMediaInsights,
} from "@/lib/socialflow/meta/core";

type AccountRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  auth_meta: string | null;
};

type MediaPostRow = {
  id: string;
  saas_id: string;
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
    try {
      const authMeta =
        account.auth_meta ? (JSON.parse(account.auth_meta) as Record<string, unknown>) : null;
      const encryptedToken =
        typeof authMeta?.accessToken === "string" ? authMeta.accessToken : null;
      const igUserId =
        typeof authMeta?.igUserId === "string" ? authMeta.igUserId : null;

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

      const insights = await fetchInstagramAccountInsights(pageToken, igUserId);
      const ctx = await resolveSocialContext({
        tenantId: account.tenant_id,
        saasId: account.saas_id,
      });

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
        },
      });

      // Per-media insights — only for posts SocialFlow published (have externalPostId match)
      const media = await fetchInstagramRecentMedia(pageToken, igUserId).catch(() => []);
      for (const item of media.slice(0, 10)) {
        try {
          const { results: matchingPosts } = await socialDb
            .prepare(
              `SELECT id, saas_id FROM saas_social_posts
               WHERE tenant_id = ? AND external_post_id = ? LIMIT 1`,
            )
            .bind(account.tenant_id, item.id)
            .all<MediaPostRow>();

          if (!matchingPosts?.length) continue;

          const matchingPost = matchingPosts[0];
          const mediaInsights = await fetchInstagramMediaInsights(pageToken, item.id);
          const mediaCtx =
            matchingPost.saas_id !== account.saas_id
              ? await resolveSocialContext({
                  tenantId: account.tenant_id,
                  saasId: matchingPost.saas_id,
                })
              : ctx;

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
            },
          });

          mediaProcessed++;
        } catch (mediaError) {
          console.warn(`[MetricsCron] Media ${item.id} insights error:`, mediaError);
        }
      }

      processed++;
    } catch (error) {
      console.error(`[MetricsCron] Account ${account.id} error:`, error);
      errors++;
    }
  }

  return { processed, errors, mediaProcessed };
}
