export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getLatestStrategicPlan } from "@/lib/socialflow/ai/agents/StrategicPlanningAgent";
import { env } from "@/lib/cf";
import { SocialContextError } from "@/lib/socialflow/repository";

const DEFAULT_SAAS_ID = "socialflow";

function resolveSaasId(request: Request): string {
  const requestUrl = new URL(request.url);
  return requestUrl.searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const saasId = resolveSaasId(request);

    const dracoEnv = env();
    if (!dracoEnv?.SOCIAL_DB) {
      return NextResponse.json({ ok: false, error: "SOCIAL_DB_UNAVAILABLE" }, { status: 503 });
    }

    const plan = await getLatestStrategicPlan(session.tenantId, saasId, dracoEnv);
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_STRATEGIC_PLAN_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to load strategic plan" }, { status: 500 });
  }
}
