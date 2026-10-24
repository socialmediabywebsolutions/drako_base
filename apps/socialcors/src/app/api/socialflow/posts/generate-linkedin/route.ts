export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { env } from "@/lib/cf";
import { SocialFlowOrchestrator } from "@/lib/socialflow/ai/SocialFlowOrchestrator";
import { ImageAnalysisAgent } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";
import { TrendAgent } from "@/lib/socialflow/ai/agents/TrendAgent";
import { ContentGeneratorAgent } from "@/lib/socialflow/ai/agents/ContentGeneratorAgent";
import type { KeywordEngineOutput, StrategyItem } from "@/lib/socialflow/ai/types";

// LinkedIn penaliza el hashtag spam — muy distinto al rango 10-15 que aplica
// OptimizationAgent para Instagram. Por eso este endpoint no reutiliza ese agente:
// hace su propia extracción simple, capada al límite de LinkedIn.
const MAX_LINKEDIN_HASHTAGS = 5;

function unauthorizedResponse() {
  return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
}

// ContentGeneratorAgent no tiene un campo "hashtags" separado en su tipo de salida —
// los devuelve embebidos en el texto (mismo comportamiento que consume
// OptimizationAgent para Instagram, ver ese archivo). Aquí se separan a mano y se
// recortan al límite de LinkedIn en vez de rellenar/forzar un mínimo como hace
// OptimizationAgent.
function splitHashtags(text: string): { body: string; hashtags: string[] } {
  const found = Array.from(new Set(text.match(/#[\p{L}0-9_]+/gu) ?? []));
  const body = text
    .replace(/#[\p{L}0-9_]+/gu, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { body, hashtags: found.slice(0, MAX_LINKEDIN_HASHTAGS) };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string;
      imageUrl?: string;
      imageKey?: string;
    } | null;

    if (!body?.saasId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId is required" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);

    const orchestrator = new SocialFlowOrchestrator();
    const profile = await orchestrator.buildProfile({
      tenantId: session.tenantId,
      saasId: body.saasId,
      niche: "",
      tone: "",
      frequencyPerWeek: 1,
      provider: "LINKEDIN",
      accountType: session.accountType,
    });

    // Imagen opcional — a diferencia de Instagram, LinkedIn no la requiere. Si viene,
    // se analiza igual que el flujo de Instagram (mismo agente); si no, el post se
    // genera solo a partir del KB del tenant (profile), sin ningún dato visual.
    let imageAnalysis: Awaited<ReturnType<ImageAnalysisAgent["run"]>> | null = null;
    if (body.imageUrl && body.imageKey) {
      const bucket = env()?.SOCIAL_MEDIA_BUCKET;
      if (!bucket) {
        return NextResponse.json({ code: "STORAGE_NOT_CONFIGURED" }, { status: 503 });
      }
      const r2Object = await bucket.get(body.imageKey);
      if (!r2Object) {
        return NextResponse.json({ code: "IMAGE_NOT_FOUND" }, { status: 404 });
      }
      const imageBytes = Array.from(new Uint8Array(await r2Object.arrayBuffer()));
      imageAnalysis = await new ImageAnalysisAgent().run({
        imageBytes,
        profile,
        tenantId: session.tenantId,
        saasId: body.saasId,
      });
    }

    const trends = await new TrendAgent().run({ profile });

    const strategyItem: StrategyItem = {
      id: `li_${Date.now()}`,
      dayOffset: 0,
      theme: imageAnalysis?.context ?? profile.contentPillars[0] ?? profile.niche,
      angle: imageAnalysis?.suggestedThemes[0] ?? profile.contentPillars[0] ?? profile.niche,
      format: "single",
      callToAction: profile.primaryCTA || "",
    };

    // Mismo patrón de construcción sintética (sin llamada extra a KeywordAgent) que ya
    // usa generate-from-image/route.ts para el flujo singular de Instagram.
    const keywordEngine: KeywordEngineOutput = {
      clusters: profile.contentPillars.slice(0, 3).map((pillar, i) => ({
        cluster: pillar,
        intent: (["awareness", "consideration", "conversion"] as const)[i % 3],
        difficulty: "medium" as const,
        trendScore: 70,
        seasonality: null,
        contentAngles: imageAnalysis?.suggestedThemes ?? [],
        keywords: profile.baseKeywords.slice(0, 3),
        hashtags: profile.baseHashtags.slice(0, 5),
      })),
      evergreenHashtags: profile.baseHashtags,
      trendingHashtags: trends.trendingTopics.slice(0, 5).map((t) => `#${t.replace(/\s+/g, "").toLowerCase()}`),
      nicheHashtags: profile.competitorHashtags.slice(0, 5),
      viralHashtags: [],
      campaignHashtags: profile.priorityHashtags,
    };

    const generated = await new ContentGeneratorAgent().run({
      profile,
      strategyItem,
      keywordEngine,
      trends,
      specificContext: imageAnalysis?.specificContext,
      llavaSuggestedFormat: imageAnalysis?.recommendedPostType,
      momentType: imageAnalysis?.momentType,
      tenantId: session.tenantId,
      saasId: body.saasId,
      network: "LINKEDIN",
    });

    const variant = generated.variants[0];
    const { body: text, hashtags } = splitHashtags(variant.text);

    return NextResponse.json({ body: text, hashtags });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return unauthorizedResponse();
    }
    console.error("SOCIALFLOW_LINKEDIN_GENERATE_ERROR", error);
    return NextResponse.json({ code: "SOCIALFLOW_ERROR", message: "Unable to generate LinkedIn content" }, { status: 500 });
  }
}
