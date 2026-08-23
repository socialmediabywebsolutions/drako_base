export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { env } from "@/lib/cf";
import { runTrendKeywordCron } from "@/lib/socialflow/intelligence/TrendKeywordAgent";
import { runTrendTriggerConnector } from "@/lib/socialflow/intelligence/TrendTriggerConnector";

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

  const result = await runTrendKeywordCron(bindings);

  // Nivel 3 — conector de scoring de tendencias (tenant interno, ver diseño). Corre
  // independientemente de qué nicho haya tocado runTrendKeywordCron esta vez: lee
  // directo la fila del nicho del tenant interno. runTrendTriggerConnector nunca
  // lanza, así que esto nunca puede degradar la respuesta 200 de este cron.
  const trendTrigger = await runTrendTriggerConnector(bindings);

  return NextResponse.json({ ...result, trendTrigger });
}
