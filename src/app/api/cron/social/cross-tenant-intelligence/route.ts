export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { env } from "@/lib/cf";
import { runCrossTenantIntelligenceCron } from "@/lib/socialflow/intelligence/CrossTenantIntelligenceAgent";

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

  const results = await runCrossTenantIntelligenceCron(bindings);
  return NextResponse.json({ ok: true, nichesProcessed: results.length, results });
}
