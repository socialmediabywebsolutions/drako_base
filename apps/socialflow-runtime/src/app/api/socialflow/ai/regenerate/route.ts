export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "../../../../../lib/auth/session";
import { regenerateRuntimePost } from "../../../../../lib/socialflow/ai-service";

function isTruthyFlag(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isDemoAiAllowed() {
  const env = typeof process !== "undefined" ? process.env : undefined;
  if (!env) return false;
  if (isTruthyFlag(env.SOCIALFLOW_RUNTIME_ENABLE_DEMO_AI) || isTruthyFlag(env.SOCIALFLOW_ENABLE_DEMO_AI)) return true;
  return env.NODE_ENV !== "production";
}

export async function POST(request: Request) {
  try {
    if (!isDemoAiAllowed()) {
      return NextResponse.json({
        ok: false,
        error: "SOCIALFLOW_RUNTIME_AI_DEMO_DISABLED_IN_PRODUCTION",
        message: "Deterministic runtime AI is disabled in production. Enable a real provider before activation.",
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
