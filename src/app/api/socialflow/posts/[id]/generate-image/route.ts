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

const TONE_STYLE_MAP: [string, string][] = [
  ["luxury",   "luxury lifestyle photography, elegant minimal composition, premium quality, cinematic lighting"],
  ["premium",  "luxury lifestyle photography, elegant minimal composition, premium quality, cinematic lighting"],
  ["playful",  "vibrant colorful design, dynamic composition, energetic lifestyle photography"],
  ["fun",      "vibrant colorful design, dynamic composition, energetic lifestyle photography"],
  ["health",   "wellness aesthetic, clean white background, fresh natural colors, health lifestyle photography"],
  ["fitness",  "dynamic sports photography, energy in motion, bold colors, athletic lifestyle"],
  ["food",     "food photography, shallow depth of field, warm tones, appetizing presentation, natural lighting"],
  ["tech",     "clean futuristic aesthetic, dark gradient background, neon accent lights, product visualization"],
  ["fashion",  "editorial fashion photography, high contrast, model silhouette, bold graphic composition"],
  ["bold",     "bold graphic design, high contrast colors, strong visual impact, dynamic composition"],
];

function resolveVisualStyle(tone: string, niche: string): string {
  const combined = `${tone} ${niche}`.toLowerCase();
  for (const [keyword, style] of TONE_STYLE_MAP) {
    if (combined.includes(keyword)) return style;
  }
  return "clean corporate photography, modern office environment, neutral tones, business professional";
}

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

    const subject =
      post.title ||
      (post.metadata?.angle as string | undefined) ||
      post.body.slice(0, 100);

    const imagePrompt = [
      subject,
      `${brandName} brand`,
      `${niche} industry`,
      resolveVisualStyle(tone, niche),
      "professional social media marketing image",
      "high quality photorealistic",
      "no text no watermarks no logos",
    ].join(", ");

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
