export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { guardAiAccess } from "@/lib/socialflow/billing/enforce";
import { resolveSocialContext, SocialContextError, upsertSaasSocialCampaign } from "@/lib/socialflow/repository";

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

    const aiGuard = await guardAiAccess(session.tenantId, session.role);
    if (!aiGuard.ok) {
      return NextResponse.json(
        { ok: false, error: aiGuard.code, message: aiGuard.message, planCode: aiGuard.planCode },
        { status: 403 },
      );
    }

    const saasId = body.saasId ?? "socialflow";
    const niche = body.niche;
    const tone = body.tone;
    const frequencyPerWeek = body.frequencyPerWeek;

    const queue = env()?.SOCIALFLOW_AI_QUEUE;
    if (!queue) {
      return NextResponse.json({ ok: false, error: "SOCIALFLOW_AI_QUEUE_UNAVAILABLE" }, { status: 503 });
    }

    const campaignId = `ai_campaign_${Date.now()}`;
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    await upsertSaasSocialCampaign(ctx, {
      id: campaignId,
      saasId,
      name: `AI Campaign: ${niche}`,
      objective: null,
      status: "GENERATING",
      targetSegment: "DEFAULT",
      startDate: null,
      endDate: null,
      budgetEstimate: null,
      notes: null,
    });

    await queue.send({ tenantId: session.tenantId, saasId, niche, tone, frequencyPerWeek, campaignId });

    return NextResponse.json({ ok: true, campaignId, status: "GENERATING" }, { status: 202 });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_AI_GENERATE_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}
