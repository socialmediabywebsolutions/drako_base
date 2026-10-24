import { env } from "@/lib/cf";

// Lectura/escritura de drako_social_posts (DRACO_DB, migración 0209). La usan el
// AutoPublishAgent, /api/social-posts y /api/cron/auto-publish.

export const SOCIAL_POSTS_PAGE_SIZE = 10;
export const SOCIAL_POST_PLATFORMS = ["instagram", "linkedin", "facebook"] as const;
export const SOCIAL_POST_STATUSES = ["pendiente", "publicado", "descartado"] as const;
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

export type SocialPost = {
  id: number;
  platform: string;
  content: string;
  hashtags: string[];
  source_article_id: string | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
};

export type SocialPostInput = {
  platform: string;
  content: string;
  hashtags: string[];
  sourceArticleId: string | null;
  scheduledAt?: string | null;
};

type SocialPostRow = Omit<SocialPost, "hashtags"> & { hashtags: string | null };

function requireDb(): D1Database {
  const db = env()?.DRACO_DB;
  if (!db) throw new Error("DRACO_DB not configured");
  return db;
}

function parseHashtags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export async function listSocialPosts(page: number, limit = SOCIAL_POSTS_PAGE_SIZE): Promise<{
  items: SocialPost[];
  page: number;
  totalPages: number;
  total: number;
}> {
  const db = requireDb();
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const safeLimit = Math.min(Math.max(1, Math.floor(limit) || SOCIAL_POSTS_PAGE_SIZE), 50);
  const [countRow, rows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total FROM drako_social_posts`).first<{ total: number }>(),
    db
      .prepare(
        `SELECT id, platform, content, hashtags, source_article_id, status, scheduled_at, published_at, created_at
         FROM drako_social_posts
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(safeLimit, (safePage - 1) * safeLimit)
      .all<SocialPostRow>(),
  ]);
  const total = Number(countRow?.total ?? 0);
  return {
    items: (rows.results ?? []).map((row) => ({ ...row, hashtags: parseHashtags(row.hashtags) })),
    page: safePage,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    total,
  };
}

export async function insertSocialPosts(items: SocialPostInput[]): Promise<number> {
  if (!items.length) return 0;
  const db = requireDb();
  const results = await db.batch(
    items.map((item) =>
      db
        .prepare(
          `INSERT INTO drako_social_posts (platform, content, hashtags, source_article_id, status, scheduled_at)
           VALUES (?, ?, ?, ?, 'pendiente', ?)`,
        )
        .bind(item.platform, item.content, JSON.stringify(item.hashtags), item.sourceArticleId, item.scheduledAt ?? null),
    ),
  );
  return results.reduce((sum, r) => sum + Number((r.meta as { changes?: number } | undefined)?.changes ?? 0), 0);
}

export async function updateSocialPostStatus(id: number, status: SocialPostStatus): Promise<boolean> {
  const result = await requireDb()
    .prepare(
      `UPDATE drako_social_posts
       SET status = ?, published_at = CASE WHEN ? = 'publicado' THEN datetime('now') ELSE published_at END
       WHERE id = ?`,
    )
    .bind(status, status, id)
    .run();
  return Number((result.meta as { changes?: number } | undefined)?.changes ?? 0) > 0;
}

// Valida el cuerpo del POST: un post o un array de posts { platform, content, ... }.
export function parseSocialPostInput(body: unknown): SocialPostInput[] | null {
  const list = Array.isArray(body) ? body : body && typeof body === "object" ? [body] : null;
  if (!list?.length) return null;
  const items: SocialPostInput[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const platform = typeof r.platform === "string" ? r.platform.trim().toLowerCase() : "";
    const content = typeof r.content === "string" ? r.content.trim() : "";
    if (!(SOCIAL_POST_PLATFORMS as readonly string[]).includes(platform) || !content) return null;
    items.push({
      platform,
      content,
      hashtags: Array.isArray(r.hashtags) ? r.hashtags.filter((t): t is string => typeof t === "string") : [],
      sourceArticleId: typeof r.source_article_id === "string" ? r.source_article_id : null,
      scheduledAt: typeof r.scheduled_at === "string" ? r.scheduled_at : null,
    });
  }
  return items;
}
