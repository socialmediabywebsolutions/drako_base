export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { env } from "@/lib/cf";
import { runInfluencerBenchmarkCron } from "@/lib/socialflow/intelligence/InfluencerBenchmarkAgent";

export async function GET(request: NextRequest) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    if (error instanceof CronAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bindings = env();
  if (!bindings?.SOCIAL_DB) {
    return NextResponse.json({ ok: false, code: "SOCIAL_DB_UNAVAILABLE" }, { status: 503 });
  }
  if (!bindings?.YOUTUBE_API_KEY) {
    return NextResponse.json({ ok: false, code: "YOUTUBE_API_KEY_UNAVAILABLE" }, { status: 503 });
  }

  const results = await runInfluencerBenchmarkCron(bindings);
  return NextResponse.json({ ok: true, nichesProcessed: results.length, results });
}
