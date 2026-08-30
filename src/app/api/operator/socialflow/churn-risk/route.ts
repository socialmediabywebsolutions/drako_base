export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { env } from "@/lib/cf";
import { listHighChurnRiskTenants } from "@/lib/socialflow/ai/agents/ChurnPredictionAgent";

const DEFAULT_MIN_SCORE = 60;

// Solo lectura, solo para el equipo de Drako (requireOwnerAccess) — ChurnPredictionAgent
// nunca escribe esta señal en socialflow_intelligence_feed, así que este es el único
// lugar donde se puede ver. No integra el panel visual de CampoBaseSocialAutomationControl
// (fuera de alcance de esta tarea) — la data queda disponible aquí para quien la consuma.
export async function GET(request: Request) {
  try {
    await requireOwnerAccess(request);

    const url = new URL(request.url);
    const minScoreParam = url.searchParams.get("minScore");
    const parsedMinScore = minScoreParam ? Number.parseInt(minScoreParam, 10) : Number.NaN;
    const minScore = Number.isFinite(parsedMinScore) ? parsedMinScore : DEFAULT_MIN_SCORE;

    const dracoEnv = env();
    if (!dracoEnv?.SOCIAL_DB) {
      return NextResponse.json({ ok: false, error: "SOCIAL_DB_UNAVAILABLE" }, { status: 503 });
    }

    const tenants = await listHighChurnRiskTenants(dracoEnv, minScore);
    return NextResponse.json({ ok: true, minScore, tenants });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OPERATOR_SOCIALFLOW_CHURN_RISK_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to load churn risk tenants" }, { status: 500 });
  }
}
