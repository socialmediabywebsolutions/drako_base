export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "../../../../../lib/auth/session";
import { regenerateRuntimePost } from "../../../../../lib/socialflow/ai-service";

function isTruthyFlag(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isAiGenerationDisabled() {
  const env = typeof process !== "undefined" ? process.env : undefined;
  if (!env) return false;
  return isTruthyFlag(env.SOCIALFLOW_RUNTIME_DISABLE_AI) || isTruthyFlag(env.SOCIALFLOW_DISABLE_AI);
}

export async function POST(request: Request) {
  try {
    if (isAiGenerationDisabled()) {
      return NextResponse.json({
        ok: false,
        error: "SOCIALFLOW_RUNTIME_AI_GENERATION_DISABLED",
        message: "AI generation is disabled via operator kill switch.",
      }, { status: 503 });
    }

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
    const post = await regenerateRuntimePost({
      tenantId: session.tenantId,
      saasId: body.saasId ?? "socialflow",
      postId: body.postId,
      niche: body.niche,
      tone: body.tone,
      frequencyPerWeek: body.frequencyPerWeek,
    });

    if (!post) {
      return NextResponse.json({ ok: false, message: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, post });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, message: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_RUNTIME_AI_REGENERATE_ERROR", error);
    return NextResponse.json({ ok: false, message: "Internal Error" }, { status: 500 });
  }
}
