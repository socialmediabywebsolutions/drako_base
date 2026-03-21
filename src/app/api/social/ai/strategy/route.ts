import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { SocialFlowOrchestrator } from "@/lib/social/ai/SocialFlowOrchestrator";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      niche?: string;
      tone?: string;
      frequencyPerWeek?: number;
      saasId?: string;
    } | null;

    if (!body?.niche || !body.tone) {
      return NextResponse.json(
        { ok: false, error: "niche and tone are required" },
        { status: 400 },
      );
    }

    const { tenantId } = await requireTenantAccess(request);
    const saasId = body.saasId ?? "socialflow";

    const orchestrator = new SocialFlowOrchestrator();
    const result = await orchestrator.generateStrategyOnly({
      tenantId,
      saasId,
      niche: body.niche,
      tone: body.tone,
      frequencyPerWeek: body.frequencyPerWeek ?? 7,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("SOCIALFLOW_AI_STRATEGY_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}
