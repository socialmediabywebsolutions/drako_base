export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { SocialFlowOrchestrator } from "@/lib/socialflow/ai/SocialFlowOrchestrator";
import { getSaasSocialPostById, resolveSocialContext, upsertSaasSocialPost } from "@/lib/socialflow/repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string;
      postId?: string;
      niche?: string;
      tone?: string;
      frequencyPerWeek?: number;
    } | null;

    if (!body?.postId || !body?.niche || !body?.tone || !body?.frequencyPerWeek) {
      return NextResponse.json({ ok: false, message: "postId, niche, tone and frequencyPerWeek are required" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const saasId = body.saasId ?? "socialflow";
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const current = await getSaasSocialPostById(ctx, body.postId);
    if (!current) {
      return NextResponse.json({ ok: false, message: "Post not found" }, { status: 404 });
    }

    const orchestrator = new SocialFlowOrchestrator();
    const regenerated = await orchestrator.generateSinglePost({
      tenantId: session.tenantId,
      saasId,
      niche: body.niche,
      tone: body.tone,
      frequencyPerWeek: body.frequencyPerWeek,
    });

    const nextBody = regenerated.optimized.improvedText ?? current.body;
    const nextTitle = regenerated.strategyItem?.theme ?? current.title;
    const hashtags = regenerated.optimized.hashtags ?? [];
    const primaryVariant = regenerated.generated.variants[0];

    const post = await upsertSaasSocialPost(ctx, {
      id: current.id,
      saasId: current.saasId,
      campaignId: current.campaignId,
      channelId: current.channelId ?? null,
      provider: current.provider,
      contentType: current.contentType,
      title: nextTitle,
      body: nextBody,
      imageHint: current.imageHint,
      status: current.status,
      scheduledAt: current.scheduledAt,
      postedAt: current.postedAt,
      externalPostId: current.externalPostId,
      metadata: {
        ...(current.metadata ?? {}),
        hook: primaryVariant?.hook,
        cta: primaryVariant?.callToAction,
        hashtags,
      },
    });

    return NextResponse.json({ ok: true, post });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, message: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_AI_REGENERATE_ERROR", error);
    return NextResponse.json({ ok: false, message: "Internal Error" }, { status: 500 });
  }
}
