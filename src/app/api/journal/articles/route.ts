export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { insertJournalArticle, listPublishedJournalArticles } from "@/lib/drako/journal-repository";
import { sanitizeArticleHtml, slugify } from "@/lib/drako/JournalAgent";

// GET /api/journal/articles?page=1 — artículos publicados, 9 por página.
export async function GET(request: Request) {
  const page = Number(new URL(request.url).searchParams.get("page") ?? "1");
  try {
    const result = await listPublishedJournalArticles(page);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("JOURNAL_ARTICLES_LIST_ERROR", error);
    return NextResponse.json({ ok: false, error: "JOURNAL_ARTICLES_UNAVAILABLE" }, { status: 500 });
  }
}

// POST /api/journal/articles — crea un artículo. Authorization: Bearer <CRON_SECRET>.
export async function POST(request: Request) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    const status = error instanceof CronAuthError ? error.status : 401;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unauthorized" }, { status });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const excerpt = typeof body?.excerpt === "string" ? body.excerpt.trim() : "";
  const content = typeof body?.content === "string" ? sanitizeArticleHtml(body.content) : "";
  if (!title || !excerpt || !content) {
    return NextResponse.json({ ok: false, error: "title, excerpt and content are required" }, { status: 400 });
  }

  try {
    const article = await insertJournalArticle({
      slug: slugify(typeof body?.slug === "string" && body.slug.trim() ? body.slug : title) || `articulo-${Date.now().toString(36)}`,
      title,
      excerpt,
      content,
      coverImageUrl: typeof body?.cover_image_url === "string" ? body.cover_image_url : null,
      category: typeof body?.category === "string" && body.category.trim() ? slugify(body.category) || "ia" : "ia",
      tags: Array.isArray(body?.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [],
      readingTime: typeof body?.reading_time === "number" && body.reading_time > 0 ? Math.round(body.reading_time) : 5,
      seoTitle: typeof body?.seo_title === "string" ? body.seo_title : null,
      seoDescription: typeof body?.seo_description === "string" ? body.seo_description : null,
    });
    return NextResponse.json({ ok: true, article }, { status: 201 });
  } catch (error) {
    console.error("JOURNAL_ARTICLE_CREATE_ERROR", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "JOURNAL_ARTICLE_CREATE_FAILED" }, { status: 500 });
  }
}
