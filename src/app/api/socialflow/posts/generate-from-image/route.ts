export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { env } from "@/lib/cf";
import { SocialContextError } from "@/lib/socialflow/repository";
import { SocialFlowOrchestrator } from "@/lib/socialflow/ai/SocialFlowOrchestrator";
import { ImageAnalysisAgent } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";
import { ContentGeneratorAgent } from "@/lib/socialflow/ai/agents/ContentGeneratorAgent";
import { OptimizationAgent } from "@/lib/socialflow/ai/agents/OptimizationAgent";
import { SchedulerAgent } from "@/lib/socialflow/ai/agents/SchedulerAgent";
import type { KeywordEngineOutput, StrategyItem } from "@/lib/socialflow/ai/types";
import type { TrendInsights } from "@/lib/socialflow/ai/agents/TrendAgent";

function unauthorizedResponse() {
  return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      imageUrl?: string;
      imageKey?: string;
      saasId?: string;
      provider?: string;
      startDate?: string;   // YYYY-MM-DD — when set, pins the post to that exact day
    } | null;

    if (!body?.imageUrl || !body?.imageKey || !body?.saasId) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "imageUrl, imageKey and saasId are required" },
        { status: 400 },
      );
    }

    const session = await requireCurrentSocialFlowSession(request);

    // Build full brand profile (includes KB context, same as orchestrator)
    const orchestrator = new SocialFlowOrchestrator();
    const profile = await orchestrator.buildProfile({
      tenantId: session.tenantId,
      saasId: body.saasId,
      niche: "",
      tone: "",
      frequencyPerWeek: 1,
    });

    // The upload flow is always a creator posting their own photo — force first-person voice
    // regardless of what the profile heuristic derived. This is the safety net.
    if (!profile.voiceInstruction) {
      profile.voiceInstruction = `Escribe en primera persona singular (yo). Habla directamente como si fueras ${profile.brandIdentity} dirigiéndote a tu audiencia. NUNCA uses "${profile.brandIdentity}" en tercera persona ni como si fuera una empresa. Ejemplo correcto: "Te comparto..." — Ejemplo incorrecto: "En ${profile.brandIdentity} compartimos..."`;
    }

    // Read image bytes directly from R2 binding (avoids public URL fetch)
    const bucket = env()?.SOCIAL_MEDIA_BUCKET;
    if (!bucket) {
      return NextResponse.json(
        { code: "STORAGE_NOT_CONFIGURED", message: "Media storage is not configured" },
        { status: 503 },
      );
    }
    const r2Object = await bucket.get(body.imageKey);
    if (!r2Object) {
      return NextResponse.json(
        { code: "IMAGE_NOT_FOUND", message: "Image not found in storage" },
        { status: 404 },
      );
    }
    const imageBytes = Array.from(new Uint8Array(await r2Object.arrayBuffer()));

    // Step 1: Analyze image with LLaVA
    const imageAgent = new ImageAnalysisAgent();
    const imageAnalysis = await imageAgent.run({ imageBytes, profile });

    // Step 2: Build synthetic StrategyItem from the image analysis (no LLM call)
    const strategyItem: StrategyItem = {
      id: `img_${Date.now()}`,
      dayOffset: 0,
      theme: imageAnalysis.context,
      angle: imageAnalysis.suggestedThemes[0] ?? profile.niche,
      format:
        imageAnalysis.recommendedPostType === "REEL"
          ? "reel"
          : imageAnalysis.recommendedPostType === "STORY"
          ? "story"
          : "single",
      callToAction: profile.primaryCTA || "Conoce más en el enlace de la bio.",
    };

    // Step 3: Build minimal KeywordEngineOutput from profile (no LLM call)
    const keywordEngine: KeywordEngineOutput = {
      clusters: profile.contentPillars.slice(0, 3).map((pillar, i) => ({
        cluster: pillar,
        intent: (["awareness", "consideration", "conversion"] as const)[i % 3],
        difficulty: "medium" as const,
        trendScore: 70,
        seasonality: null,
        contentAngles: imageAnalysis.suggestedThemes,
        keywords: profile.baseKeywords.slice(0, 3),
        hashtags: profile.baseHashtags.slice(0, 5),
      })),
      evergreenHashtags: profile.baseHashtags,
      trendingHashtags: profile.priorityHashtags,
      nicheHashtags: profile.competitorHashtags.slice(0, 5),
      viralHashtags: [],
      campaignHashtags: [],
    };

    // Step 4: Build minimal TrendInsights from image analysis (no LLM call)
    const emotionCapped = imageAnalysis.emotion.length > 0
      ? imageAnalysis.emotion.charAt(0).toUpperCase() + imageAnalysis.emotion.slice(1)
      : "Auténtico";
    const trends: TrendInsights = {
      trendingTopics: imageAnalysis.suggestedThemes,
      viralAngles: [
        `${emotionCapped} — lo que nos hace diferentes`,
        ...profile.viralThemes.slice(0, 2),
      ],
      emergingPatterns: [`Contenido visual auténtico sobre ${profile.niche}`],
      shortFormOpportunities: [
        `${imageAnalysis.recommendedPostType} mostrando ${imageAnalysis.context}`,
      ],
      hookIdeas: [
        `${emotionCapped}: esto es lo que hacemos diferente`,
        `Detrás de cámaras: ${imageAnalysis.description.slice(0, 60)}`,
        `¿Sabes qué hace especial a ${profile.brandIdentity}? Mira esto`,
      ],
    };

    // Step 5: Generate caption (Mistral via Workers AI)
    const contentAgent = new ContentGeneratorAgent();
    const generated = await contentAgent.run({ profile, strategyItem, keywordEngine, trends });
    const variant = generated.variants[0];

    // Step 6: Optimize caption + enforce hashtag limit (Mistral via Workers AI)
    const optimizationAgent = new OptimizationAgent();
    const optimized = await optimizationAgent.run({ profile, variant, keywordEngine });

    // Enrich hashtags when the LLM returned fewer than 10.
    // The brand profile may have very few base hashtags configured; supplement
    // from image themes and profile hashtag pools so we always ship 10–15 tags.
    if (optimized.hashtags.length < 10) {
      const themeHashtags = imageAnalysis.suggestedThemes
        .map((t) =>
          "#" +
          t
            .replace(/\s+/g, "")
            .replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9]/g, "")
        )
        .filter((h) => h.length > 2);

      const supplementPool = [
        ...optimized.hashtags,
        ...themeHashtags,
        ...(profile.competitorHashtags ?? []),
        ...(profile.priorityHashtags ?? []),
        ...(profile.baseHashtags ?? []),
      ];
      optimized.hashtags = Array.from(new Set(supplementPool))
        .filter(Boolean)
        .slice(0, 15);
    }

    // Step 7: Calculate best schedule slot (deterministic, no LLM).
    // When startDate is provided by the caller (multi-upload batch), use it as
    // both startDate and endDate so the post is pinned to that exact day.
    const schedulerAgent = new SchedulerAgent();
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const targetDate = body.startDate ?? tomorrow;
    const [schedulePlan] = schedulerAgent.run({
      strategy: [strategyItem],
      frequencyPerWeek: 1,
      startDate: targetDate,
      endDate: targetDate,
    });

    const provider = body.provider ?? "INSTAGRAM";
    const contentTypeMap: Record<string, "FEED" | "REEL" | "STORY"> = {
      REEL: "REEL",
      STORY: "STORY",
      FEED: "FEED",
    };
    const contentType = contentTypeMap[imageAnalysis.recommendedPostType] ?? "FEED";
    const title = optimized.improvedText.split("\n")[0]?.replace(/^#+\s*/, "").slice(0, 72).trim()
      ?? strategyItem.theme;

    return NextResponse.json({
      imageUrl: body.imageUrl,
      imageAnalysis,
      suggestedPost: {
        title,
        body: optimized.improvedText,
        hashtags: optimized.hashtags,
        imageHint: body.imageUrl,
        provider,
        contentType,
        scheduledAt: schedulePlan?.scheduledAt ?? new Date(Date.now() + 86_400_000).toISOString(),
        saasId: body.saasId,
      },
    });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json(
        { code: "INVALID_SOCIAL_CONTEXT", message: error.message },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return unauthorizedResponse();
    }
    console.error("SOCIALFLOW_GENERATE_FROM_IMAGE_ERROR", error);
    return NextResponse.json(
      { code: "SOCIALFLOW_ERROR", message: "Unable to generate post from image" },
      { status: 500 },
    );
  }
}
