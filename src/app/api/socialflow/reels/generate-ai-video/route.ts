export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      imageUrl?: string;
      saasId?: string;
      prompt?: string;
    } | null;

    const imageUrl = body?.imageUrl?.trim() ?? "";
    const saasId = body?.saasId?.trim() ?? "";

    if (!imageUrl || !saasId) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY", message: "imageUrl and saasId are required" }, { status: 400 });
    }
    if (!imageUrl.startsWith("http")) {
      return NextResponse.json({ ok: false, error: "INVALID_IMAGE_URL", message: "imageUrl must be a public HTTPS URL" }, { status: 400 });
    }

    // tenantId siempre se deriva de la sesión autenticada, nunca del body — mismo
    // criterio que reels/generate/route.ts: evita que un cliente pida un job de vídeo
    // a nombre de otro tenant pasando un tenantId ajeno.
    const session = await requireCurrentSocialFlowSession(request);

    const bindings = env();
    const socialDb = bindings?.SOCIAL_DB;
    const queue = bindings?.SOCIALFLOW_AI_QUEUE;
    if (!socialDb || !queue) {
      return NextResponse.json({ ok: false, error: "SERVICE_UNAVAILABLE" }, { status: 503 });
    }

    const jobId = crypto.randomUUID();
    const prompt = body?.prompt?.trim() || null;
    const nowIso = new Date().toISOString();

    await socialDb
      .prepare(
        `INSERT INTO socialflow_ai_video_jobs (id, tenant_id, saas_id, image_url, prompt, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .bind(jobId, session.tenantId, saasId, imageUrl, prompt, nowIso, nowIso)
      .run();

    // Corre en workers/socialflow-ai-worker (consumer dedicado de esta misma cola, ver
    // src/index.ts ahí) — nunca en el worker principal, mismo motivo que la generación
    // completa de campañas: un modelo de vídeo real puede tardar bastante más que el
    // límite práctico de duración de request que ya topamos antes en este pipeline
    // (ver generate-from-image/route.ts).
    await queue.send({ type: "ai_video", jobId, tenantId: session.tenantId, saasId, imageUrl, prompt: prompt ?? undefined });

    return NextResponse.json({ jobId, status: "pending" }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_GENERATE_AI_VIDEO_ERROR", error);
    return NextResponse.json({ ok: false, error: "SOCIALFLOW_ERROR", message: "Unable to start AI video generation" }, { status: 500 });
  }
}
