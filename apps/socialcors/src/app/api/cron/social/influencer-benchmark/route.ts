export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/socialflow/platform/cron/auth";
import { guardCronTurn } from "@/lib/socialflow/platform/cron/lock";
import { env } from "@/lib/cf";
import { runInfluencerBenchmarkCron } from "@/lib/socialflow/intelligence/InfluencerBenchmarkAgent";
import { withAgentExecutionLog } from "@/lib/socialflow/intelligence/agent-execution-log";

export async function GET(request: NextRequest) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    if (error instanceof CronAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locked = await guardCronTurn(request, "influencer-benchmark", 10080);
  if (locked) return locked;

  const bindings = env();
  if (!bindings?.SOCIAL_DB) {
    return NextResponse.json({ ok: false, code: "SOCIAL_DB_UNAVAILABLE" }, { status: 503 });
  }
  if (!bindings?.YOUTUBE_API_KEY) {
    return NextResponse.json({ ok: false, code: "YOUTUBE_API_KEY_UNAVAILABLE" }, { status: 503 });
  }

  const results = await withAgentExecutionLog({
    db: bindings.SOCIAL_DB,
    agentName: "InfluencerBenchmarkAgent",
    tenantId: null,
    saasId: null,
    run: () => runInfluencerBenchmarkCron(bindings),
    rowsWritten: (r) => r.filter((x) => x.written).length,
  });
  return NextResponse.json({
    ok: true,
    nichesProcessed: results.filter((x) => x.ok).length,
    rowsWritten: results.filter((x) => x.written).length,
    youtubeFailures: results.filter((x) => x.error === "YOUTUBE_FETCH_FAILED").length,
    results,
  });
}
