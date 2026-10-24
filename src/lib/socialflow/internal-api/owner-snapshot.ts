import type { SocialFlowOwnerSnapshot } from "@/lib/capabilities/internal-api-types/socialflow";

// Resumen de negocio para el panel del holding (P6), calculado en SOCIAL_DB.
// tenantId null = agregado de toda la plataforma; con tenantId, solo ese tenant.

type CountRow = { n: number | null };

async function count(db: D1Database, sql: string, binds: unknown[]): Promise<number> {
  const row = await db.prepare(sql).bind(...binds).first<CountRow>();
  return Number(row?.n ?? 0);
}

export async function computeSocialCorsOwnerSnapshot(
  db: D1Database,
  tenantId: string | null,
  now: number = Date.now(),
): Promise<SocialFlowOwnerSnapshot> {
  const tenantFilter = tenantId ? " AND tenant_id = ?" : "";
  const tenantBinds = tenantId ? [tenantId] : [];
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [activeCampaigns, scheduledPosts, failedPostsLast24h, connectedProfiles, lastRun] = await Promise.all([
    count(db, `SELECT COUNT(*) AS n FROM saas_social_campaigns WHERE status = 'ACTIVE'${tenantFilter}`, tenantBinds),
    count(db, `SELECT COUNT(*) AS n FROM saas_social_posts WHERE status = 'SCHEDULED'${tenantFilter}`, tenantBinds),
    count(
      db,
      `SELECT COUNT(*) AS n FROM saas_social_posts WHERE status = 'FAILED' AND datetime(updated_at) >= datetime(?)${tenantFilter}`,
      [since24h, ...tenantBinds],
    ),
    count(db, `SELECT COUNT(*) AS n FROM saas_social_accounts WHERE status = 'CONNECTED_REAL'${tenantFilter}`, tenantBinds),
    db
      .prepare(`SELECT MAX(posted_at) AS last_run FROM saas_social_posts WHERE status = 'POSTED'${tenantFilter}`)
      .bind(...tenantBinds)
      .first<{ last_run: string | null }>(),
  ]);

  return {
    status: failedPostsLast24h > 0 ? "degraded" : "ok",
    activeCampaigns,
    scheduledPosts,
    failedPostsLast24h,
    connectedProfiles,
    lastRunAt: lastRun?.last_run ?? null,
  };
}
