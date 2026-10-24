import { env } from "@/lib/cf";
import { getCloudflareContextSafeAsync } from "@/lib/socialflow/platform/cloudflare-runtime";
import { publishSocialPostLive } from "@/lib/socialflow/live-publishing";
import { recoverStalePublishingPosts, resolveSocialContext } from "@/lib/socialflow/repository";
import { isAutoPublishBlockedByPrivatePilotMode } from "@/lib/socialflow/private-pilot";
import { processDeferredInstagramMetrics } from "@/lib/socialflow/meta/metrics-collector";

// Límites de publicación diaria por tenant — coincide con "Máx. 2 publicaciones/día"
// declarado en todos los planes de pago (plans.ts). Se aplica contando posts con
// status='POSTED' cuyo posted_at caiga en el día UTC actual.
const MAX_POSTS_PER_DAY_PER_TENANT = 2;

// Intervalo mínimo entre publicaciones del mismo tenant (en ms). Evita ráfagas
// si varios posts de un mismo tenant vencen al mismo tiempo en un tick del cron.
const MIN_PUBLISH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

type DuePostRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
};

// Cuántos posts ha publicado este tenant hoy (UTC). Falla seguro: si la query lanza,
// devuelve 0 (permite continuar) — la idempotencia del claim sigue siendo el backstop.
async function countTodayPublishedPosts(db: D1Database, tenantId: string, saasId: string): Promise<number> {
  try {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM saas_social_posts
         WHERE tenant_id = ? AND saas_id = ? AND status = 'POSTED'
           AND date(posted_at) = date('now')`,
      )
      .bind(tenantId, saasId)
      .first<{ cnt: number }>();
    return row?.cnt ?? 0;
  } catch {
    return 0;
  }
}

// Timestamp del último post publicado por este tenant (NULL si ninguno hoy ni ayer).
// Falla seguro: si la query lanza, devuelve null (permite continuar).
async function getLastPostedAt(db: D1Database, tenantId: string, saasId: string): Promise<string | null> {
  try {
    const row = await db
      .prepare(
        `SELECT posted_at FROM saas_social_posts
         WHERE tenant_id = ? AND saas_id = ? AND status = 'POSTED'
           AND posted_at IS NOT NULL
         ORDER BY posted_at DESC LIMIT 1`,
      )
      .bind(tenantId, saasId)
      .first<{ posted_at: string }>();
    return row?.posted_at ?? null;
  } catch {
    return null;
  }
}

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

  // Caché en memoria por tenant para esta corrida — evita múltiples queries a D1 si el
  // mismo tenant tiene varios posts vencidos en el mismo tick.
  const tenantDailyCountCache = new Map<string, number>();
  const tenantLastPostedCache = new Map<string, string | null>();

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

    const tenantKey = `${post.tenant_id}:${post.saas_id}`;

    // Guardrail 1 — cap diario: no más de MAX_POSTS_PER_DAY_PER_TENANT posts publicados hoy.
    if (!tenantDailyCountCache.has(tenantKey)) {
      tenantDailyCountCache.set(tenantKey, await countTodayPublishedPosts(socialDb, post.tenant_id, post.saas_id));
    }
    const todayCount = tenantDailyCountCache.get(tenantKey)!;
    if (todayCount >= MAX_POSTS_PER_DAY_PER_TENANT) {
      results.push({
        id: post.id,
        tenantId: post.tenant_id,
        saasId: post.saas_id,
        status: "SKIPPED",
        code: "DAILY_CAP_REACHED",
        message: `Tenant already has ${todayCount} post(s) published today (max ${MAX_POSTS_PER_DAY_PER_TENANT}).`,
      });
      continue;
    }

    // Guardrail 2 — intervalo mínimo: no publicar si el último post fue hace menos de
    // MIN_PUBLISH_INTERVAL_MS. Evita ráfagas de publicación ante vencimientos simultáneos.
    if (!tenantLastPostedCache.has(tenantKey)) {
      tenantLastPostedCache.set(tenantKey, await getLastPostedAt(socialDb, post.tenant_id, post.saas_id));
    }
    const lastPostedAt = tenantLastPostedCache.get(tenantKey);
    if (lastPostedAt) {
      const msSinceLast = Date.now() - new Date(lastPostedAt).getTime();
      if (msSinceLast < MIN_PUBLISH_INTERVAL_MS) {
        const waitMin = Math.ceil((MIN_PUBLISH_INTERVAL_MS - msSinceLast) / 60_000);
        results.push({
          id: post.id,
          tenantId: post.tenant_id,
          saasId: post.saas_id,
          status: "SKIPPED",
          code: "MIN_INTERVAL_NOT_ELAPSED",
          message: `Last post published ${Math.floor(msSinceLast / 60_000)} min ago — wait ${waitMin} more min.`,
        });
        continue;
      }
    }

    try {
      const ctx = await resolveSocialContext({
        tenantId: post.tenant_id,
        saasId: post.saas_id,
      });
      const result = await publishSocialPostLive(ctx, post.id);

      if (result.ok) {
        // Actualizar caché en memoria para proteger los posts subsiguientes de este tenant
        // en el mismo tick (el valor real de D1 se leerá de nuevo en el siguiente tick).
        tenantDailyCountCache.set(tenantKey, todayCount + 1);
        tenantLastPostedCache.set(tenantKey, new Date().toISOString());
      }

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
