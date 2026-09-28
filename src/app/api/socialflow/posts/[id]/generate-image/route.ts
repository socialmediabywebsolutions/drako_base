export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import {
  getSaasSocialPostById,
  resolveSocialContext,
  SocialContextError,
  upsertSaasSocialPost,
} from "@/lib/socialflow/repository";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import { generatePostImage } from "@/lib/socialflow/ai/image-generator";
import { buildImagePrompt } from "@/lib/socialflow/ai/image-prompt-builder";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: postId } = await params;
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as { saasId?: string } | null;
    const saasId = body?.saasId ?? "socialflow";

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const post = await getSaasSocialPostById(ctx, postId);
    if (!post) {
      return NextResponse.json({ ok: false, error: "POST_NOT_FOUND" }, { status: 404 });
    }

    const profile = await getChannelProfile(session.tenantId, saasId).catch(() => null);
    const niche = profile?.niche ?? saasId;
    const brandName = profile?.brandName ?? saasId;
    const tone = profile?.toneOfVoice ?? "professional";

    const imagePrompt = buildImagePrompt(
      { body: post.body, theme: post.title || undefined, angle: post.metadata?.angle as string | undefined },
      { brandIdentity: brandName, niche, toneOfVoice: tone },
    );

    const imageUrl = await generatePostImage(imagePrompt, postId, session.tenantId);
    if (!imageUrl) {
      return NextResponse.json(
        { ok: false, error: "IMAGE_GENERATION_UNAVAILABLE", message: "AI o almacenamiento no disponible" },
        { status: 503 },
      );
    }

    await upsertSaasSocialPost(ctx, {
      id: post.id,
      saasId: post.saasId,
      channelId: post.channelId ?? null,
      campaignId: post.campaignId,
      provider: post.provider,
      contentType: post.contentType,
      title: post.title,
      body: post.body,
      imageHint: imageUrl,
      status: post.status,
      scheduledAt: post.scheduledAt,
      postedAt: post.postedAt,
      externalPostId: post.externalPostId,
      creationMode: post.creationMode,
      metadata: post.metadata,
    });

    return NextResponse.json({ ok: true, imageUrl });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_POST_IMAGE_GEN_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}
