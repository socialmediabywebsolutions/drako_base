export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { guardAiAccess } from "@/lib/socialflow/billing/enforce";
import { SocialFlowOrchestrator } from "@/lib/socialflow/ai/SocialFlowOrchestrator";
import { ReelsAgent } from "@/lib/socialflow/reels/ReelsAgent";
import type { MusicTrackDeps } from "@/lib/socialflow/reels/music-selector";
import { env } from "@/lib/cf";

// Solo decide la Capa 3 (ReelsAgent) en el servidor y devuelve el ReelsConfig — la
// Capa 2 (CanvasRenderer, Canvas API + WebCodecs) es tecnología de navegador y no
// puede ejecutarse en el runtime de Cloudflare Workers de esta app. El cliente que
// llame a este endpoint es quien debe correr CanvasRenderer con el config recibido
// y subir el Blob resultante a /api/socialflow/media/upload (ya acepta video/mp4).
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { imageUrl?: string; saasId?: string } | null;
    const imageUrl = body?.imageUrl?.trim() ?? "";
    const saasId = body?.saasId?.trim() ?? "";

    if (!imageUrl || !saasId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "imageUrl and saasId are required" }, { status: 400 });
    }
    if (!imageUrl.startsWith("http")) {
      return NextResponse.json({ code: "INVALID_IMAGE_URL", message: "imageUrl must be a public HTTPS URL" }, { status: 400 });
    }

    // tenantId siempre se deriva de la sesión autenticada, nunca del body — evita que
    // un cliente pida el perfil de otro tenant pasando un tenantId ajeno.
    const session = await requireCurrentSocialFlowSession(request);

    const aiGuard = await guardAiAccess(session.tenantId, session.role);
    if (!aiGuard.ok) {
      return NextResponse.json(
        { code: aiGuard.code, message: aiGuard.message, planCode: aiGuard.planCode },
        { status: 403 },
      );
    }

    const orchestrator = new SocialFlowOrchestrator();
    const profile = await orchestrator.buildProfile({
      tenantId: session.tenantId,
      saasId,
      niche: "",
      tone: "",
      frequencyPerWeek: 1,
      accountType: session.accountType,
    });

    // Sin SOCIAL_DB/SOCIAL_MEDIA_R2_PUBLIC_URL (ej. entorno local sin bindings) el Reel
    // se genera sin música de fondo en vez de fallar — ver sanitizeConfig en ReelsAgent.
    const cfEnv = env();
    const music: MusicTrackDeps | undefined =
      cfEnv?.SOCIAL_DB && cfEnv?.SOCIAL_MEDIA_R2_PUBLIC_URL
        ? { db: cfEnv.SOCIAL_DB, r2PublicUrl: cfEnv.SOCIAL_MEDIA_R2_PUBLIC_URL }
        : undefined;

    const config = await new ReelsAgent().run({ imageUrl, profile, music });

    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_REELS_GENERATE_ERROR", error);
    return NextResponse.json({ code: "SOCIALFLOW_ERROR", message: "Unable to generate Reels config" }, { status: 500 });
  }
}
