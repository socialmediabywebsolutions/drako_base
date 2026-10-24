export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { requireOwnerAccess } from "@/lib/auth/session";
import { generateFundingOpportunities } from "@/lib/drako/funding-generator";
import { insertFundingOpportunities } from "@/lib/drako/funding-repository";

// POST /api/cron/funding — ejecución manual del Agente de Financiación ("Ejecutar
// ahora" en /grants). Acepta Bearer <CRON_SECRET | INTERNAL_API_SECRET> o la sesión del
// operator: el botón usa la sesión, así el secreto nunca viaja en el bundle del cliente.
// El cron semanal no pasa por aquí — drako-scheduler genera y hace POST a
// /api/funding/opportunities.
async function authorize(request: NextRequest): Promise<NextResponse | null> {
  if (request.headers.get("authorization")) {
    try {
      verifyCronAuth(request);
      return null;
    } catch (error) {
      const status = error instanceof CronAuthError ? error.status : 401;
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unauthorized" }, { status });
    }
  }
  try {
    await requireOwnerAccess(request);
    return null;
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await authorize(request);
  if (denied) return denied;

  try {
    const opportunities = generateFundingOpportunities();
    const inserted = await insertFundingOpportunities(opportunities);
    console.log(`[funding-agent] ${inserted} oportunidades insertadas (manual)`);
    return NextResponse.json({ ok: true, generated: opportunities.length, inserted });
  } catch (error) {
    console.error("DRAKO_FUNDING_CRON_ERROR", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "DRAKO_FUNDING_CRON_FAILED" }, { status: 500 });
  }
}
