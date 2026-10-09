
import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth, CronAuthError } from "@/lib/security/cron-auth";
import { guardCronTurn } from "@/lib/security/cron-lock";
import { processScheduledPosts } from "@/lib/socialflow/scheduler";

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

  try {
    const batch = await processScheduledPosts();
    return NextResponse.json({ 
      success: true, 
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
