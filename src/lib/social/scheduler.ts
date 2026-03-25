import { env } from "@/lib/cf";
import { publishSocialPostLive } from "@/lib/social/live-publishing";
import { resolveSocialContext } from "@/lib/social/repository";

type DuePostRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
};

export async function processScheduledPosts() {
  const bindings = env();
  const socialDb = bindings?.SOCIAL_DB;
  if (!socialDb) {
    throw new Error("SOCIAL_DB not configured");
  }

  const now = new Date().toISOString();
  const { results: posts } = await socialDb.prepare(
    `SELECT id, tenant_id, saas_id
     FROM saas_social_posts
     WHERE status = 'SCHEDULED'
       AND scheduled_at IS NOT NULL
       AND datetime(scheduled_at) <= datetime(?)
     ORDER BY datetime(scheduled_at) ASC
     LIMIT 20`,
  ).bind(now).all<DuePostRow>();

  if (!posts?.length) {
    return [];
  }

  const results: Array<{ id: string; tenantId: string; saasId: string; status: string; message: string | null }> = [];

  for (const post of posts) {
    try {
      const ctx = await resolveSocialContext({
        tenantId: post.tenant_id,
        saasId: post.saas_id,
      });
      const result = await publishSocialPostLive(ctx, post.id);
      results.push({
        id: post.id,
        tenantId: post.tenant_id,
        saasId: post.saas_id,
        status: result.ok ? "PUBLISHED" : "FAILED",
        message: result.message ?? null,
      });
    } catch (error) {
      results.push({
        id: post.id,
        tenantId: post.tenant_id,
        saasId: post.saas_id,
        status: "ERROR",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
