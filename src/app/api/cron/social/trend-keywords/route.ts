export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { env } from "@/lib/cf";
import { runTrendKeywordCron } from "@/lib/socialflow/intelligence/TrendKeywordAgent";
import { runTrendTriggerConnector } from "@/lib/socialflow/intelligence/TrendTriggerConnector";
import { withAgentExecutionLog } from "@/lib/socialflow/intelligence/agent-execution-log";

// Mismo tenant piloto hardcodeado que TrendTriggerConnector.ts:12-17 y
// trend-triggers/route.ts:16 — no exportado desde el propio conector, así que se repite
// aquí solo para el log de ejecución, no para ninguna lógica de negocio.
const TREND_TRIGGER_TENANT_ID = "775444ce-5ed0-4e69-864f-dc3e0d886817";

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

  const results = await withAgentExecutionLog({
    db: bindings.SOCIAL_DB,
    agentName: "TrendKeywordAgent",
    tenantId: null,
    saasId: null,
    run: () => runTrendKeywordCron(bindings),
    rowsWritten: (r) => r.length,
  });

  // Nivel 3 — conector de scoring de tendencias (tenant interno, ver diseño). Corre
  // independientemente de qué nicho(s) haya tocado runTrendKeywordCron esta vez: lee
  // directo la fila del nicho del tenant interno. runTrendTriggerConnector nunca
  // lanza, así que esto nunca puede degradar la respuesta 200 de este cron.
  const trendTrigger = await withAgentExecutionLog({
    db: bindings.SOCIAL_DB,
    agentName: "TrendTriggerConnector",
    tenantId: TREND_TRIGGER_TENANT_ID,
    saasId: "socialflow",
    run: () => runTrendTriggerConnector(bindings),
    rowsWritten: (r) => (r.ok && r.triggered ? 1 : 0),
  });

  return NextResponse.json({ ok: true, batchSize: results.length, results, trendTrigger });
}
