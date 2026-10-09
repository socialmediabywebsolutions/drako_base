export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { isActiveSocialFlowTrial } from "@/lib/socialflow/billing/enforce";
import { SocialFlowOrchestrator } from "@/lib/socialflow/ai/SocialFlowOrchestrator";
import { getSaasSocialPostById, resolveSocialContext, upsertSaasSocialPost } from "@/lib/socialflow/repository";

function isTruthyFlag(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function isAiGenerationDisabled() {
  return isTruthyFlag(typeof process !== "undefined" ? process.env.SOCIALFLOW_DISABLE_AI : undefined);
}

async function rewriteWithInstruction(body: string, instruction: string): Promise<string> {
  const e = env();
  if (!e?.AI) return body;
  try {
    const result = await e.AI.run("@cf/meta/llama-3.1-70b-instruct", {
      messages: [
        {
          role: "system",
          content:
            "Eres un copywriter experto en redes sociales. Reescribe el post siguiendo exactamente la instrucción del usuario. Devuelve SOLO el texto del post reescrito, sin explicaciones ni comillas.",
        },
        {
          role: "user",
          content: `Post original:\n${body}\n\nInstrucción: ${instruction}\n\nReescribe el post en español siguiendo la instrucción.`,
        },
      ],
    }) as { response?: string };
    const rewritten = result?.response?.trim();
    return rewritten && rewritten.length > 20 ? rewritten : body;
  } catch {
    return body;
  }
}

export async function POST(request: Request) {
  try {
    if (isAiGenerationDisabled()) {
      return NextResponse.json({ ok: false, error: "SOCIALFLOW_AI_GENERATION_DISABLED" }, { status: 503 });
    }

    const body = (await request.json().catch(() => null)) as {
      saasId?: string;
      postId?: string;
      instruction?: string;
    } | null;

    if (!body?.postId) {
      return NextResponse.json({ ok: false, message: "postId is required" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const saasId = body.saasId ?? "socialflow";
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const current = await getSaasSocialPostById(ctx, body.postId);
    if (!current) {
      return NextResponse.json({ ok: false, message: "Post not found" }, { status: 404 });
    }
    const applyTrialCaptionLink = await isActiveSocialFlowTrial(session.tenantId, session.role);

    // Instruction-based rewrite: use LLM to apply the instruction directly
    if (body.instruction?.trim()) {
      const newBody = await rewriteWithInstruction(current.body, body.instruction.trim());
      const post = await upsertSaasSocialPost(ctx, {
        id: current.id,
        saasId: current.saasId,
        campaignId: current.campaignId,
        channelId: current.channelId ?? null,
        provider: current.provider,
        contentType: current.contentType,
        title: current.title,
        body: newBody,
        imageHint: current.imageHint,
        status: current.status,
        scheduledAt: current.scheduledAt,
        postedAt: current.postedAt,
        externalPostId: current.externalPostId,
        creationMode: current.creationMode,
        metadata: current.metadata,
      }, { applyTrialCaptionLink });
      return NextResponse.json({ ok: true, post });
    }

    // Full regeneration via orchestrator (no instruction — generate from scratch)
    const orchestrator = new SocialFlowOrchestrator();
    const regenerated = await orchestrator.generateSinglePost({
      tenantId: session.tenantId,
      saasId,
      niche: "",  // buildProfile loads niche from DB profile
      tone: "",   // buildProfile loads tone from DB profile
      frequencyPerWeek: 7,
    });

    const nextBody = regenerated.optimized.improvedText ?? current.body;
    const nextTitle = regenerated.strategyItem?.theme ?? current.title;
    const hashtags = (regenerated.optimized.hashtags ?? []).slice(0, 15);
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
      creationMode: current.creationMode,
      metadata: {
        ...(current.metadata ?? {}),
        hook: primaryVariant?.hook,
        cta: primaryVariant?.callToAction,
        hashtags,
      },
    }, { applyTrialCaptionLink });

    return NextResponse.json({ ok: true, post });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, message: "SESSION_REQUIRED" }, { status: 401 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("SOCIALFLOW_AI_REGENERATE_ERROR", { message: msg });
    return NextResponse.json({ ok: false, message: "Internal Error" }, { status: 500 });
  }
}
