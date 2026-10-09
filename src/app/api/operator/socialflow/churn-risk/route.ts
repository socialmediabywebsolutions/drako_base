export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { getCampoBaseSocialFlowChurnRisk } from "@/lib/campamento-base/socialflow-control-plane-service";

const DEFAULT_MIN_SCORE = 60;

// Solo lectura, solo para el equipo de Drako (requireOwnerAccess). ChurnPredictionAgent nunca
// escribe esta señal en el feed del cliente, así que este es el único lugar donde se ve.
// P6: el dato lo calcula SocialCors (GET /api/internal/socialflow/churn-risk).
export async function GET(request: Request) {
  try {
    await requireOwnerAccess(request);

    const minScoreParam = new URL(request.url).searchParams.get("minScore");
    const parsedMinScore = minScoreParam ? Number.parseInt(minScoreParam, 10) : Number.NaN;
    const minScore = Number.isFinite(parsedMinScore) ? parsedMinScore : DEFAULT_MIN_SCORE;

    const tenants = await getCampoBaseSocialFlowChurnRisk(minScore);
    return NextResponse.json({ ok: true, minScore, tenants });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OPERATOR_SOCIALFLOW_CHURN_RISK_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to load churn risk tenants" }, { status: 502 });
  }
}
