export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "../../../../../lib/auth/session";
import { generateRuntimeCampaign } from "../../../../../lib/socialflow/ai-service";

export async function POST(request: Request) {
  try {
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
    const result = await generateRuntimeCampaign({
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
    console.error("SOCIALFLOW_RUNTIME_AI_GENERATE_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}
