
import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth, CronAuthError } from "@/lib/security/cron-auth";
import { guardCronTurn } from "@/lib/security/cron-lock";
import { processScheduledPosts } from "@/lib/socialflow/scheduler";
import { resolvePublishSchedulerOwner, WEB_FALLBACK_MIN_OVERDUE_MINUTES } from "@/lib/socialflow/publish-scheduler-owner";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    verifyCronAuth(req);
  } catch (error) {
    if (error instanceof CronAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locked = await guardCronTurn(req, "social-publish", 5);
  if (locked) return locked;

  // Con owner=ai el Worker IA publica cada minuto; aquí solo se recogen los posts que
  // lleven más de WEB_FALLBACK_MIN_OVERDUE_MINUTES vencidos (?force=1 lo procesa todo).
  const owner = resolvePublishSchedulerOwner();
  const fallbackOnly = owner === "ai" && req.nextUrl.searchParams.get("force") !== "1";

  try {
    const batch = await processScheduledPosts(
      fallbackOnly ? { minOverdueMinutes: WEB_FALLBACK_MIN_OVERDUE_MINUTES } : {},
    );
    return NextResponse.json({ 
      success: true, 
      owner,
      mode: fallbackOnly ? "fallback_overdue_only" : "all_due",
      processed: batch.results.length,
      recovered: batch.recovered,
      results: batch.results,
    });
  } catch (error) {
    console.error("[SocialCron] Scheduler failed", error);
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 });
  }
}
