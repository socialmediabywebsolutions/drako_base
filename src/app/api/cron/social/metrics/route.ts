import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth, CronAuthError } from "@/lib/security/cron-auth";
import { processInstagramMetrics } from "@/lib/socialflow/meta/metrics-collector";

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

  try {
    const result = await processInstagramMetrics();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[SocialMetricsCron] Failed", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
