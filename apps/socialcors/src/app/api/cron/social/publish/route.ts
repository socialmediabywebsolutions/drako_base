export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { guardCronTurn } from "@/lib/security/cron-lock";
import { processScheduledPosts } from "@/lib/socialflow/scheduler";
import { resolvePublishSchedulerOwner, WEB_FALLBACK_MIN_OVERDUE_MINUTES } from "@/lib/socialflow/publish-scheduler-owner";

const SOCIAL_DB_LOCAL_HINT = "Run `npm run build:worker && npx wrangler dev --config wrangler.workers.toml` to load D1 bindings in local.";

function isSocialDbUnavailableError(error: unknown) {
  return error instanceof Error && error.message.includes("SOCIAL_DB not configured");
}

export async function GET(request: NextRequest) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    if (error instanceof CronAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locked = await guardCronTurn(request, "social-publish", 5);
  if (locked) return locked;

  // Con owner=ai el Worker IA publica cada minuto; aquí solo se recogen los posts que
  // lleven más de WEB_FALLBACK_MIN_OVERDUE_MINUTES vencidos (?force=1 lo procesa todo).
  const owner = resolvePublishSchedulerOwner();
  const fallbackOnly = owner === "ai" && request.nextUrl.searchParams.get("force") !== "1";

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
    console.error("SOCIAL_CRON_PUBLISH_ERROR", error);
    if (isSocialDbUnavailableError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: "SOCIAL_DB_UNAVAILABLE",
          message: "SOCIAL_DB is not configured in the current local runtime.",
          details: {
            binding: "SOCIAL_DB",
            currentRuntime: "local_without_workers_bindings",
            expectedRuntime: "wrangler.workers",
            hint: SOCIAL_DB_LOCAL_HINT,
          },
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        code: "SOCIAL_CRON_PUBLISH_FAILED",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
