import { env } from "@/lib/cf";

// Lectura/escritura de drako_journal_articles (DRACO_DB, migración 0205). La usan la
// API (/api/journal/articles), el cron (/api/cron/journal) y las páginas del journal
// directamente — las páginas no se llaman a su propia API por HTTP desde el worker.

export const JOURNAL_PAGE_SIZE = 9;

export type JournalArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  category: string;
  tags: string[];
  readingTime: number;
  publishedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type JournalArticleInput = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  category: string;
  tags: string[];
  readingTime: number;
  seoTitle: string | null;
  seoDescription: string | null;
};

type JournalArticleRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  category: string;
  tags: string;
  reading_time: number;
  published_at: string;
  seo_title: string | null;
  seo_description: string | null;
};

const SELECT_COLUMNS =
  "id, slug, title, excerpt, content, cover_image_url, category, tags, reading_time, published_at, seo_title, seo_description";

function requireDb(): D1Database {
  const db = env()?.DRACO_DB;
  if (!db) throw new Error("DRACO_DB not configured");
  return db;
}

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function mapRow(row: JournalArticleRow): JournalArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    coverImageUrl: row.cover_image_url,
    category: row.category,
    tags: parseTags(row.tags),
    readingTime: row.reading_time,
    publishedAt: row.published_at,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
  };
}

export async function listPublishedJournalArticles(page: number): Promise<{
  articles: JournalArticle[];
  page: number;
  totalPages: number;
  total: number;
}> {
  const db = requireDb();
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const offset = (safePage - 1) * JOURNAL_PAGE_SIZE;

  const [countRow, rows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total FROM drako_journal_articles WHERE is_published = 1`).first<{ total: number }>(),
    db
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM drako_journal_articles
         WHERE is_published = 1
         ORDER BY datetime(published_at) DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(JOURNAL_PAGE_SIZE, offset)
      .all<JournalArticleRow>(),
  ]);

  const total = Number(countRow?.total ?? 0);
  return {
    articles: (rows.results ?? []).map(mapRow),
    page: safePage,
    totalPages: Math.max(1, Math.ceil(total / JOURNAL_PAGE_SIZE)),
    total,
  };
}

export async function getPublishedJournalArticleBySlug(slug: string): Promise<JournalArticle | null> {
  const row = await requireDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM drako_journal_articles WHERE slug = ? AND is_published = 1 LIMIT 1`)
    .bind(slug)
    .first<JournalArticleRow>();
  return row ? mapRow(row) : null;
}

async function slugExists(db: D1Database, slug: string): Promise<boolean> {
  const row = await db.prepare(`SELECT 1 AS found FROM drako_journal_articles WHERE slug = ? LIMIT 1`).bind(slug).first();
  return Boolean(row);
}

// Si el slug ya existe (mismo tema en otra semana), se le añade la fecha — el
// artículo nunca se pierde por choque de UNIQUE.
export async function insertJournalArticle(input: JournalArticleInput): Promise<JournalArticle> {
  const db = requireDb();
  let slug = input.slug;
  if (await slugExists(db, slug)) {
    slug = `${slug}-${new Date().toISOString().slice(0, 10)}`;
  }
  if (await slugExists(db, slug)) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO drako_journal_articles
         (slug, title, excerpt, content, cover_image_url, category, tags, reading_time, published_at, is_published, seo_title, seo_description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    )
    .bind(
      slug,
      input.title,
      input.excerpt,
      input.content,
      input.coverImageUrl,
      input.category,
      JSON.stringify(input.tags),
      input.readingTime,
      now,
      input.seoTitle,
      input.seoDescription,
      now,
      now,
    )
    .run();

  const created = await getPublishedJournalArticleBySlug(slug);
  if (!created) throw new Error("JOURNAL_ARTICLE_INSERT_NOT_FOUND");
  return created;
}
