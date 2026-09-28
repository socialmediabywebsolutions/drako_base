import { env } from "@/lib/cf";

export type RevistaArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  saasId: string | null;
  category: string;
  coverImageUrl: string | null;
  authorName: string;
  publishedAt: number;
  createdAt: number;
  status: "draft" | "published";
  sourcePostIds: string[];
};

export type HoldingSocialPost = {
  id: string;
  saasId: string;
  saasName: string;
  body: string;
  provider: string;
  postedAt: string | null;
  externalPostId: string | null;
};

type RevistaArticleRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  saas_id: string | null;
  category: string;
  cover_image_url: string | null;
  author_name: string;
  published_at: number;
  created_at: number;
  status: string;
  source_post_ids: string | null;
};

type SocialPostRow = {
  id: string;
  saas_id: string;
  body: string;
  provider: string;
  posted_at: string | null;
  external_post_id: string | null;
};

const SAAS_NAMES: Record<string, string> = {
  socialcors: "SocialCors",
  clinic: "Drako Clinic",
  studio: "Drako Studio",
};

function resolveSaasName(saasId: string): string {
  return SAAS_NAMES[saasId] ?? saasId;
}

function mapArticleRow(row: RevistaArticleRow): RevistaArticle {
  let sourcePostIds: string[] = [];
  try {
    const parsed = row.source_post_ids ? JSON.parse(row.source_post_ids) : [];
    if (Array.isArray(parsed)) sourcePostIds = parsed.filter((v): v is string => typeof v === "string");
  } catch {
    // ignore parse errors
  }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    saasId: row.saas_id,
    category: row.category,
    coverImageUrl: row.cover_image_url,
    authorName: row.author_name,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    status: row.status as "draft" | "published",
    sourcePostIds,
  };
}

function getDb() {
  const bindings = env();
  const db = bindings?.DRACO_DB;
  if (!db) throw new Error("DRACO_DB not available");
  return db;
}

function getSocialDb() {
  const bindings = env();
  const db = bindings?.SOCIAL_DB;
  if (!db) throw new Error("SOCIAL_DB not available");
  return db;
}

export async function listRevistaArticles({
  limit = 20,
  offset = 0,
  saasId,
}: {
  limit?: number;
  offset?: number;
  saasId?: string;
}): Promise<RevistaArticle[]> {
  const db = getDb();
  let sql: string;
  let params: unknown[];

  if (saasId) {
    sql = `SELECT * FROM revista_articles WHERE status = 'published' AND saas_id = ? ORDER BY published_at DESC LIMIT ? OFFSET ?`;
    params = [saasId, limit, offset];
  } else {
    sql = `SELECT * FROM revista_articles WHERE status = 'published' ORDER BY published_at DESC LIMIT ? OFFSET ?`;
    params = [limit, offset];
  }

  const result = await db.prepare(sql).bind(...params).all<RevistaArticleRow>();
  return (result.results ?? []).map(mapArticleRow);
}

export async function getRevistaArticle(slug: string): Promise<RevistaArticle | null> {
  const db = getDb();
  const result = await db
    .prepare(`SELECT * FROM revista_articles WHERE slug = ? AND status = 'published'`)
    .bind(slug)
    .first<RevistaArticleRow>();
  return result ? mapArticleRow(result) : null;
}

export async function saveRevistaArticle(article: RevistaArticle): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO revista_articles (id, slug, title, excerpt, body, saas_id, category, cover_image_url, author_name, published_at, created_at, status, source_post_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      article.id,
      article.slug,
      article.title,
      article.excerpt,
      article.body,
      article.saasId ?? null,
      article.category,
      article.coverImageUrl ?? null,
      article.authorName,
      article.publishedAt,
      article.createdAt,
      article.status,
      JSON.stringify(article.sourcePostIds),
    )
    .run();
}

export async function listHoldingSocialFeed({ limit = 50 }: { limit?: number } = {}): Promise<HoldingSocialPost[]> {
  const db = getSocialDb();
  const result = await db
    .prepare(
      `SELECT id, saas_id, body, provider, posted_at, external_post_id
       FROM saas_social_posts
       WHERE status = 'published'
       ORDER BY posted_at DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<SocialPostRow>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    saasId: row.saas_id,
    saasName: resolveSaasName(row.saas_id),
    body: row.body,
    provider: row.provider,
    postedAt: row.posted_at,
    externalPostId: row.external_post_id,
  }));
}
