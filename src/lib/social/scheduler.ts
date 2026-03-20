
import { getDb } from "@/lib/db";
import { publishSocialPostLive } from "@/lib/social/live-publishing";
import { resolveSocialContext } from "@/lib/social/repository";

export async function processScheduledPosts() {
  const db = getDb();
  if (!db) {
    console.error("[SocialScheduler] Database unavailable");
    return [];
  }

  // 1. Find due posts (Global Query for efficiency)
  const now = new Date().toISOString();
  // Using 'any' for the raw row to avoid tight coupling with the full type definitions for now
  const { results: posts } = await db.prepare(
    `SELECT id, tenant_id, saas_id
     FROM saas_social_posts
     WHERE status = 'SCHEDULED'
       AND scheduled_at <= ?
     ORDER BY scheduled_at ASC
     LIMIT 20` 
  ).bind(now).all<{ id: string; tenant_id: string; saas_id: string }>();

  if (!posts || posts.length === 0) {
    return [];
  }

  console.log(`[SocialScheduler] Found ${posts.length} due posts.`);
  const results = [];

  // 2. Process each
  for (const post of posts) {
    try {
      // Construct context for this specific post
      const ctx = await resolveSocialContext({
        tenantId: post.tenant_id,
        saasId: post.saas_id,
      });

      console.log(`[SocialScheduler] Publishing post ${post.id} for ${post.saas_id}...`);
      
      const result = await publishSocialPostLive(ctx, post.id);
      results.push({ 
        id: post.id, 
        status: result.ok ? "PUBLISHED" : "FAILED", 
        message: result.message 
      });
      
    } catch (error) {
      console.error(`[SocialScheduler] Error processing post ${post.id}`, error);
      results.push({ 
        id: post.id, 
        status: "ERROR", 
        message: String(error) 
      });
    }
  }

  return results;
}
