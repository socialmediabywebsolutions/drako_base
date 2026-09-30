export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { guardCronTurn } from "@/lib/security/cron-lock";
import { generateJournalArticle } from "@/lib/drako/JournalAgent";
import { insertJournalArticle } from "@/lib/drako/journal-repository";

// POST /api/cron/journal — lo llama drako-scheduler (cron "0 9 * * 1-5") vía service
// binding. Authorization: Bearer <CRON_SECRET | INTERNAL_API_SECRET>. ?force=1 salta
// el lock diario; ?topic=... fuerza el tema en vez de la rotación semanal.
export async function POST(request: NextRequest) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    const status = error instanceof CronAuthError ? error.status : 401;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unauthorized" }, { status });
  }

  const locked = await guardCronTurn(request, "drako-journal", 24 * 60);
  if (locked) return locked;

  try {
    const topic = request.nextUrl.searchParams.get("topic")?.trim() || undefined;
    const draft = await generateJournalArticle(topic);
    const article = await insertJournalArticle(draft);
    console.log("DRAKO_JOURNAL_ARTICLE_CREATED", { slug: article.slug, hasCover: Boolean(article.coverImageUrl) });
    return NextResponse.json({ ok: true, article }, { status: 201 });
  } catch (error) {
    console.error("DRAKO_JOURNAL_CRON_ERROR", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "DRAKO_JOURNAL_CRON_FAILED" },
      { status: 500 },
    );
  }
}
