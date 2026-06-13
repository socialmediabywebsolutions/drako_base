export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { SocialFlowOrchestrator } from "@/lib/socialflow/ai/SocialFlowOrchestrator";

function isTruthyFlag(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isAiGenerationDisabled() {
  const env = typeof process !== "undefined" ? process.env : undefined;
  if (!env) return false;
  return isTruthyFlag(env.SOCIALFLOW_DISABLE_AI);
}

export async function POST(request: Request) {
  try {
    if (isAiGenerationDisabled()) {
      return NextResponse.json({
        ok: false,
        error: "SOCIALFLOW_AI_GENERATION_DISABLED",
        message: "AI generation is disabled via operator kill switch.",
      }, { status: 503 });
    }

    const body = (await request.json().catch(() => null)) as {
      niche?: string;
      tone?: string;
      frequencyPerWeek?: number;
      saasId?: string;
    } | null;

    if (!body?.niche || !body.tone || !body.frequencyPerWeek) {
      return NextResponse.json({ ok: false, error: "niche, tone and frequencyPerWeek are required" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const orchestrator = new SocialFlowOrchestrator();
    const result = await orchestrator.generateFullCampaign({
      tenantId: session.tenantId,
      saasId: body.saasId ?? "socialflow",
      niche: body.niche,
      tone: body.tone,
      frequencyPerWeek: body.frequencyPerWeek,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_AI_GENERATE_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}
