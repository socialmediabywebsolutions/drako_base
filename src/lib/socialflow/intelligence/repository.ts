import { resolveSocialContext } from "@/lib/socialflow/repository";
import type { SaasSocialProvider } from "@/lib/social-core/types";
import type {
  IntelligenceFeedItem,
  IntelligenceFeedPriority,
  IntelligenceFeedStatus,
  IntelligenceFeedType,
} from "@/lib/socialflow/intelligence/types";

const SOCIALFLOW_FEED_TABLE = "socialflow_intelligence_feed";
const DEFAULT_SAAS_ID = "socialflow";

type FeedRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  action_label: string | null;
  action_href: string | null;
  source: string | null;
  network: string | null;
  created_at: string;
  updated_at: string;
};

export type NewFeedItem = {
  type: IntelligenceFeedType;
  title: string;
  description: string;
  priority: IntelligenceFeedPriority;
  actionLabel?: string | null;
  actionHref?: string | null;
  source?: string | null;
  // Opcional — ausente/null significa señal agnóstica de red (comportamiento actual de
  // todos los escritores salvo instagram/linkedin token-health). Ver IntelligenceFeedItem.
  network?: SaasSocialProvider | null;
};

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  try {
    if (globalThis.crypto?.randomUUID) return `sf_feed_${globalThis.crypto.randomUUID()}`;
  } catch {
    // ignore and fallback
  }
  return `sf_feed_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Deterministic id derived from the seed source so regenerating the feed
// from the same audit/source does not create duplicate cards.
function deterministicId(tenantId: string, saasId: string, source: string, title: string): string {
  const raw = `${tenantId}:${saasId}:${source}:${title}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `sf_feed_${hash.toString(36)}`;
}

function ensureFeedTable(db: D1Database) {
  return Promise.all([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS ${SOCIALFLOW_FEED_TABLE} (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        saas_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        action_label TEXT,
        action_href TEXT,
        source TEXT,
        network TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    ).run(),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_${SOCIALFLOW_FEED_TABLE}_tenant_saas
       ON ${SOCIALFLOW_FEED_TABLE} (tenant_id, saas_id, status)`,
    ).run(),
  ]);
}

function mapRowToItem(row: FeedRow): IntelligenceFeedItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    type: row.type as IntelligenceFeedType,
    title: row.title,
    description: row.description ?? "",
    priority: row.priority as IntelligenceFeedPriority,
    status: row.status as IntelligenceFeedStatus,
    actionLabel: row.action_label,
    actionHref: row.action_href,
    source: row.source,
    network: row.network as SaasSocialProvider | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listFeedItems(
  tenantId: string,
  saasId = DEFAULT_SAAS_ID,
  options: { statuses?: IntelligenceFeedStatus[]; limit?: number } = {},
): Promise<IntelligenceFeedItem[]> {
  const context = await resolveSocialContext({ tenantId, saasId });
  await ensureFeedTable(context.socialDb);

  const statuses = options.statuses ?? ["new", "read"];
  const limit = options.limit ?? 50;
  const placeholders = statuses.map(() => "?").join(", ");

  const result = await context.socialDb
    .prepare(
      `SELECT * FROM ${SOCIALFLOW_FEED_TABLE}
       WHERE tenant_id = ? AND saas_id = ? AND status IN (${placeholders})
       ORDER BY
         CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC,
         created_at DESC
       LIMIT ?`,
    )
    .bind(context.tenantId, context.saasId ?? saasId, ...statuses, limit)
    .all<FeedRow>();

  return (result.results ?? []).map(mapRowToItem);
}

export async function seedFeedItems(
  tenantId: string,
  items: NewFeedItem[],
  saasId = DEFAULT_SAAS_ID,
): Promise<void> {
  if (items.length === 0) return;

  const context = await resolveSocialContext({ tenantId, saasId });
  await ensureFeedTable(context.socialDb);
  const timestamp = nowIso();

  for (const item of items) {
    const source = item.source ?? "manual";
    const id = source !== "manual" ? deterministicId(tenantId, saasId, source, item.title) : generateId();

    await context.socialDb
      .prepare(
        `INSERT INTO ${SOCIALFLOW_FEED_TABLE} (
          id, tenant_id, saas_id, type, title, description, priority, status, action_label, action_href, source, network, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          priority = excluded.priority,
          action_label = excluded.action_label,
          action_href = excluded.action_href,
          network = excluded.network,
          updated_at = excluded.updated_at`,
      )
      .bind(
        id,
        tenantId,
        saasId,
        item.type,
        item.title,
        item.description,
        item.priority,
        item.actionLabel ?? null,
        item.actionHref ?? null,
        source,
        item.network ?? null,
        timestamp,
        timestamp,
      )
      .run();
  }
}

export async function updateFeedItemStatus(
  tenantId: string,
  id: string,
  status: IntelligenceFeedStatus,
  saasId = DEFAULT_SAAS_ID,
): Promise<IntelligenceFeedItem | null> {
  const context = await resolveSocialContext({ tenantId, saasId });
  await ensureFeedTable(context.socialDb);

  await context.socialDb
    .prepare(`UPDATE ${SOCIALFLOW_FEED_TABLE} SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ? AND saas_id = ?`)
    .bind(status, nowIso(), id, context.tenantId, context.saasId ?? saasId)
    .run();

  const result = await context.socialDb
    .prepare(`SELECT * FROM ${SOCIALFLOW_FEED_TABLE} WHERE id = ? AND tenant_id = ? AND saas_id = ? LIMIT 1`)
    .bind(id, context.tenantId, context.saasId ?? saasId)
    .all<FeedRow>();

  const row = result.results?.[0] ?? null;
  return row ? mapRowToItem(row) : null;
}

export async function countFeedItems(
  tenantId: string,
  saasId = DEFAULT_SAAS_ID,
  statuses: IntelligenceFeedStatus[] = ["new", "read"],
): Promise<number> {
  const context = await resolveSocialContext({ tenantId, saasId });
  await ensureFeedTable(context.socialDb);

  const placeholders = statuses.map(() => "?").join(", ");
  const result = await context.socialDb
    .prepare(`SELECT COUNT(*) as count FROM ${SOCIALFLOW_FEED_TABLE} WHERE tenant_id = ? AND saas_id = ? AND status IN (${placeholders})`)
    .bind(context.tenantId, context.saasId ?? saasId, ...statuses)
    .all<{ count: number }>();

  return result.results?.[0]?.count ?? 0;
}

// Cron-driven agents (ContentFatigueAgent, ViralOpportunityAgent) recompute their
// condition on every run and must actively clear a card once it no longer holds —
// seedFeedItems only creates/refreshes, it never removes. Callers use a `source` that
// is stable per dimension (e.g. "content_fatigue:hook", not
// "content_fatigue:hook:pregunta_directa"), so the card for a dimension gets dismissed
// here instead of orphaned when the underlying value changes.
export async function dismissFeedItemsBySource(
  tenantId: string,
  source: string,
  saasId = DEFAULT_SAAS_ID,
): Promise<void> {
  const context = await resolveSocialContext({ tenantId, saasId });
  await ensureFeedTable(context.socialDb);

  await context.socialDb
    .prepare(
      `UPDATE ${SOCIALFLOW_FEED_TABLE} SET status = 'dismissed', updated_at = ?
       WHERE tenant_id = ? AND saas_id = ? AND source = ? AND status != 'dismissed'`,
    )
    .bind(nowIso(), context.tenantId, context.saasId ?? saasId, source)
    .run();
}
