export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/socialflow/platform/cron/auth";
import { guardCronTurn } from "@/lib/socialflow/platform/cron/lock";
import { env } from "@/lib/cf";
import { runCompetitorDiscoveryCron } from "@/lib/socialflow/intelligence/CompetitorDiscoveryAgent";
import { withAgentExecutionLog } from "@/lib/socialflow/intelligence/agent-execution-log";

// Frecuencia recomendada: semanal (lunes 04:00 UTC, justo después de
// NicheIntelligenceCronAgent 03:00 UTC). Se registra en el wrangler.toml del
// worker de Socialcors con la expresión: "0 4 * * 1".
// Intervalo guardCronTurn: 10 080 min (7 días) para evitar dobles ejecuciones.
const LOCK_MINUTES = 10_080;

export async function GET(request: NextRequest) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    if (error instanceof CronAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locked = await guardCronTurn(request, "competitor-discovery", LOCK_MINUTES);
  if (locked) return locked;

  const bindings = env();
  if (!bindings?.SOCIAL_DB) {
    return NextResponse.json({ ok: false, code: "SOCIAL_DB_UNAVAILABLE" }, { status: 503 });
  }

  const results = await withAgentExecutionLog({
    db: bindings.SOCIAL_DB,
    agentName: "CompetitorDiscoveryAgent",
    tenantId: null,
    saasId: "socialflow",
    run: () => runCompetitorDiscoveryCron(bindings),
    rowsWritten: (r) => r.filter((x) => x.ok && x.saved > 0).reduce((acc, x) => acc + x.saved, 0),
  });

  const summary = {
    total: results.length,
    processed: results.filter((r) => r.ok && !r.skippedReason).length,
    skipped: results.filter((r) => r.skippedReason).length,
    failed: results.filter((r) => !r.ok).length,
    totalSaved: results.reduce((acc, r) => acc + (r.saved ?? 0), 0),
  };

  return NextResponse.json({ ok: true, summary, results });
}
