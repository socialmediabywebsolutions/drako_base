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

    if (!body?.niche || !body.tone || !body.frequencyPerWeek) {
      return NextResponse.json(
        { ok: false, error: "niche, tone and frequencyPerWeek are required" },
        { status: 400 },
      );
    }

    const { tenantId } = await requireTenantAccess(request);
    const saasId = body.saasId ?? "socialflow";

    const orchestrator = new SocialFlowOrchestrator();
    const result = await orchestrator.generateFullCampaign({
      tenantId,
      saasId,
      niche: body.niche,
      tone: body.tone,
      frequencyPerWeek: body.frequencyPerWeek,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("SOCIALFLOW_AI_GENERATE_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}
