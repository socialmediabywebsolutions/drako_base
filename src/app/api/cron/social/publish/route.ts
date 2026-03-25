export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { processScheduledPosts } from "@/lib/social/scheduler";

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

  try {
    const results = await processScheduledPosts();
    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
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
