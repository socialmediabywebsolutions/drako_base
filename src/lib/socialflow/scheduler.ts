import { env } from "@/lib/cf";
import { getCloudflareContextSafeAsync } from "@/lib/cloudflare/runtime";
import { publishSocialPostLive } from "@/lib/socialflow/live-publishing";
import { recoverStalePublishingPosts, resolveSocialContext } from "@/lib/socialflow/repository";
import { isAutoPublishBlockedByPrivatePilotMode } from "@/lib/socialflow/private-pilot";
import { processDeferredInstagramMetrics } from "@/lib/socialflow/meta/metrics-collector";

type DuePostRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
};

type SchedulerPostResult = { id: string; tenantId: string; saasId: string; status: string; code: string | null; message: string | null };

export type ProcessScheduledPostsOptions = {
  // Solo posts vencidos hace al menos estos minutos. Lo usa el Worker web como red de
  // seguridad cuando el Worker IA es el responsable (ver publish-scheduler-owner.ts).
  minOverdueMinutes?: number;
};

export async function processScheduledPosts(
  options: ProcessScheduledPostsOptions = {},
): Promise<{ results: SchedulerPostResult[]; recovered: number }> {
  const bindings = env();
  const socialDb = bindings?.SOCIAL_DB;
  if (!socialDb) {
    throw new Error("SOCIAL_DB not configured");
  }

  const recovered = await recoverStalePublishingPosts(socialDb);
  if (recovered > 0) {
    console.log(`[SocialFlow Scheduler] Recovered ${recovered} stale PUBLISHING post(s) back to SCHEDULED.`);
  }

  const overdueMs = Math.max(0, options.minOverdueMinutes ?? 0) * 60 * 1000;
  const now = new Date(Date.now() - overdueMs).toISOString();
  const { results: posts } = await socialDb.prepare(
    `SELECT id, tenant_id, saas_id
     FROM saas_social_posts
     WHERE status IN ('SCHEDULED', 'APPROVED')
       AND scheduled_at IS NOT NULL
       AND datetime(scheduled_at) <= datetime(?)
     ORDER BY datetime(scheduled_at) ASC
     LIMIT 20`,
  ).bind(now).all<DuePostRow>();

  if (!posts?.length) {
    return { results: [], recovered };
  }

  console.log(`[SocialFlow Scheduler] Found ${posts.length} due post(s) to publish.`);

  const results: SchedulerPostResult[] = [];

  for (const post of posts) {
    if (isAutoPublishBlockedByPrivatePilotMode(bindings)) {
      results.push({
        id: post.id,
        tenantId: post.tenant_id,
        saasId: post.saas_id,
        status: "SKIPPED",
        code: "PRIVATE_PILOT_AUTOPUBLISH_BLOCKED",
        message: "Auto-publish is blocked while SOCIALFLOW_PRIVATE_PILOT_MODE is enabled.",
      });
      continue;
    }

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
        code: result.code ?? null,
        message: result.message ?? null,
      });
    } catch (error) {
      results.push({
        id: post.id,
        tenantId: post.tenant_id,
        saasId: post.saas_id,
        status: "ERROR",
        code: "SCHEDULER_EXCEPTION",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const published = results.filter((r) => r.status === "PUBLISHED").length;
  const failed = results.filter((r) => r.status !== "PUBLISHED").length;
  console.log(`[SocialFlow Scheduler] Batch complete: ${published} published, ${failed} failed, ${recovered} recovered.`);

  // Fetch metrics for Instagram posts published 15 min–2 h ago with no metrics row yet.
  // Runs every scheduler tick (every 5 min) so the window is always covered.
  // Use ctx.waitUntil so the Cloudflare isolate stays alive until the async work finishes.
  const metricsWork = processDeferredInstagramMetrics().catch((err) => {
    console.warn("[SocialFlow Scheduler] Deferred metrics error:", err instanceof Error ? err.message : String(err));
  });
  getCloudflareContextSafeAsync()
    .then((cfCtx) => {
      const ctx = (cfCtx as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } } | null)?.ctx;
      if (ctx?.waitUntil) {
        ctx.waitUntil(metricsWork);
      }
    })
    .catch(() => { /* best-effort */ });

  return { results, recovered };
}
