// Actividad de publicación en SOCIAL_DB.socialflow_publish_activity (migración 0253).
// Sustituye a observability-core (DRACO_DB) para los eventos publish_* de live-publishing.

export type PublishActivityStatus = "info" | "success" | "error";

export type PublishActivity = {
  id: string;
  tenantId: string;
  saasId: string;
  postId: string;
  activityType: string;
  status: PublishActivityStatus;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type PublishActivityRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  post_id: string;
  activity_type: string;
  status: PublishActivityStatus;
  summary: string;
  metadata: string | null;
  created_at: string;
};

export async function recordPublishActivity(
  db: D1Database,
  input: Omit<PublishActivity, "id" | "createdAt" | "metadata"> & { metadata?: Record<string, unknown> | null },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO socialflow_publish_activity (id, tenant_id, saas_id, post_id, activity_type, status, summary, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.tenantId,
      input.saasId,
      input.postId,
      input.activityType,
      input.status,
      input.summary,
      input.metadata ? JSON.stringify(input.metadata) : null,
      new Date().toISOString(),
    )
    .run();
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function listPublishActivities(
  db: D1Database,
  filters: { tenantId: string; saasId: string; limit?: number },
): Promise<PublishActivity[]> {
  const { results } = await db
    .prepare(
      `SELECT id, tenant_id, saas_id, post_id, activity_type, status, summary, metadata, created_at
       FROM socialflow_publish_activity
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(filters.tenantId, filters.saasId, filters.limit ?? 10)
    .all<PublishActivityRow>();

  return (results ?? []).map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    postId: row.post_id,
    activityType: row.activity_type,
    status: row.status,
    summary: row.summary,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
  }));
}
