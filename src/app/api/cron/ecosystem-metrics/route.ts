export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { guardCronTurn } from "@/lib/security/cron-lock";
import { EcosystemMetricsAgent } from "@/lib/drako/EcosystemMetricsAgent";

// POST /api/cron/ecosystem-metrics — lo llama drako-scheduler (cron "0 8 * * *") vía
// service binding. Authorization: Bearer <CRON_SECRET | INTERNAL_API_SECRET>. ?force=1
// salta el lock diario.
export async function POST(request: NextRequest) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    const status = error instanceof CronAuthError ? error.status : 401;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unauthorized" }, { status });
  }

  const locked = await guardCronTurn(request, "drako-ecosystem-metrics", 24 * 60);
  if (locked) return locked;

  try {
    const { fetchedAt, stored, skipped } = await EcosystemMetricsAgent.fetchAndStore();
    const live = stored.filter((s) => s.source === "live").length;
    console.log("DRAKO_ECOSYSTEM_METRICS_STORED", { fetchedAt, stored: stored.length, live, skipped: skipped.length });
    return NextResponse.json({ ok: true, fetchedAt, live, mock: stored.length - live, stored, skipped });
  } catch (error) {
    console.error("DRAKO_ECOSYSTEM_METRICS_CRON_ERROR", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "DRAKO_ECOSYSTEM_METRICS_CRON_FAILED" },
      { status: 500 },
    );
  }
}
