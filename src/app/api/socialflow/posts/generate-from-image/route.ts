export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { env } from "@/lib/cf";
import { SocialContextError, resolveSocialContext, getFutureScheduledSlots } from "@/lib/socialflow/repository";
import { SocialFlowOrchestrator } from "@/lib/socialflow/ai/SocialFlowOrchestrator";
import { ImageAnalysisAgent } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";
import type { ImageAnalysis } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";
import { TrendAgent } from "@/lib/socialflow/ai/agents/TrendAgent";
import { ContentGeneratorAgent } from "@/lib/socialflow/ai/agents/ContentGeneratorAgent";
import { OptimizationAgent } from "@/lib/socialflow/ai/agents/OptimizationAgent";
import type { KeywordEngineOutput, StrategyItem } from "@/lib/socialflow/ai/types";

function unauthorizedResponse() {
  return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
}

// Map photo content (from LLaVA analysis) to the best UTC posting hour.
// Returns null when the content is ambiguous — caller falls back to batchIndex rotation.
// Hour rationale (fitness/lifestyle niche, Spain+LatAm audience UTC):
//   7h  — workout content: people check Instagram before/after morning training
//  12h  — food/nutrition: people browse during lunch break
//  18h  — motivation/mindset: people decompress after work
//  21h  — rest/recovery: evening wind-down browsing
function pickHourFromContent(analysis: ImageAnalysis): number | null {
  const raw = [analysis.description, analysis.context, ...analysis.suggestedThemes].join(" ");
  // Normalize: lowercase + strip diacritics so "nutrición" matches "nutrici"
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  // Exercise / physical activity → 7h
  if (/ejercici|entrena|workout|gym\b|cardio|pesas|rutina|correr|running|spinning|crossfit|muscula|atletismo|deporte|actividad fisica|movimiento|fuerza/.test(text)) return 7;

  // Food / nutrition / meal → 12h
  if (/comida|receta|almuerzo|ensalada|comer|cocin|plato|verdura|fruta|desayuno|snack|merienda|aliment|nutritiv|nutrici|dieta|ingredi|meal|saludable/.test(text)) return 12;

  // Mindset / motivation / transformation → 18h
  if (/motivaci|inspiraci|mindset|actitud|positiv|superaci|exito|logro|\bmeta\b|objetivo|reflexi|mentalidad|transform|cambio|habito|proposito|bienestar mental/.test(text)) return 18;

  // Rest / recovery / night routine → 21h
  if (/descanso|recuperaci|dormir|sueno|relajaci|\bspa\b|masaj|meditaci|noche/.test(text)) return 21;

  return null; // ambiguous — use batchIndex rotation
}

// Strip greeting openings the LLM generates despite prompt instructions.
// Two-pass: removes the greeting word, then residual vocatives ("chicas!") that survive.
function cleanOpening(text: string): string {
  return text
    .replace(
      /^[¡!]*\s*(hola|hey|buenas?(?:\s+(?:d[ií]as?|tardes?|noches?))?|buenos\s+d[ií]as?)\b[^a-záéíóúüñ\n]*/i,
      "",
    )
    .replace(/^chicas?\s*[!,.\s¡]*/i, "")
    .trimStart();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      imageUrl?: string;
      imageKey?: string;
      saasId?: string;
      provider?: string;
      startDate?: string;
      batchIndex?: number;  // 0-based position of this image in the upload batch
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

    // Step 1: Analyze image (LLaVA) + trends (Mistral) in parallel — no interdependency
    const [imageAnalysis, trends] = await Promise.all([
      new ImageAnalysisAgent().run({ imageBytes, profile }),
      new TrendAgent().run({ profile }),
    ]);

    // Step 2: Build StrategyItem from image analysis (no LLM call)
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

    // Step 3: Keyword engine — synthetic clusters enriched with real TrendAgent output.
    // KeywordAgent was removed from this path because it added a sequential Mistral call
    // that pushed total request time past the Cloudflare Workers 30s limit. TrendAgent
    // (already running in parallel with LLaVA) provides the most valuable signal: real
    // trending hashtags and hook ideas for this niche.
    const imageThemeHashtags = imageAnalysis.suggestedThemes
      .map((t) => `#${t.replace(/\s+/g, "").replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9]/g, "").toLowerCase()}`)
      .filter((h) => h.length > 2);
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
      // trendingHashtags now comes from TrendAgent (real Mistral output) + image themes
      trendingHashtags: [
        ...trends.trendingTopics.map((t) => `#${t.replace(/\s+/g, "").replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9]/g, "").toLowerCase()}`),
        ...imageThemeHashtags,
      ].filter((h) => h.length > 2).slice(0, 10),
      nicheHashtags: profile.competitorHashtags.slice(0, 5),
      viralHashtags: profile.viralThemes.map((t) => `#${t.replace(/\s+/g, "").toLowerCase()}`),
      campaignHashtags: profile.priorityHashtags,
    };

    // Step 5: Generate caption (Mistral via Workers AI)
    const contentAgent = new ContentGeneratorAgent();
    const generated = await contentAgent.run({ profile, strategyItem, keywordEngine, trends });
    const variant = generated.variants[0];

    // Step 6: Optimize caption + enforce hashtag limit (Mistral via Workers AI)
    const optimizationAgent = new OptimizationAgent();
    const optimized = await optimizationAgent.run({ profile, variant, keywordEngine });

    // Strip any greeting the LLM generated despite prompt instructions.
    optimized.improvedText = cleanOpening(optimized.improvedText);

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

    // Step 7: Calculate best schedule slot — day-based pass system (31-day window).
    // Pass 1 fills each of the 31 days with 1 post. Pass 2 adds a 2nd post to those
    // same days. The HOUR is always derived from pickHourFromContent — the pass only
    // determines which DAY to use.
    const DAY_MS = 86_400_000;
    const todayUtc = new Date().toISOString().slice(0, 10);

    const socialCtx = await resolveSocialContext({ tenantId: session.tenantId, saasId: body.saasId });
    const futureSlots = await getFutureScheduledSlots(socialCtx).catch(() => [] as string[]);

    // Resolve hour pool — prefer AI-provided hours, fall back to niche heuristic
    const FITNESS_RE = /fitness|lifestyle|wellness|salud|health|gym|sport|yoga|pilates|nutrici|coach|entrenami|ejercici/i;
    const nicheHours = FITNESS_RE.test(profile.niche) ? [7, 12, 18] : [9, 18];
    const aiHours = (trends.optimalHours ?? []).filter((h) => Number.isInteger(h) && h >= 0 && h < 24).slice(0, 3);
    const resolvedHours = aiHours.length >= 2 ? aiHours : nicheHours;

    // Build 31-day window starting tomorrow
    const windowStartMs = new Date(todayUtc + "T00:00:00Z").getTime() + DAY_MS;
    const windowDays: string[] = [];
    for (let i = 0; i < 31; i++) {
      windowDays.push(new Date(windowStartMs + i * DAY_MS).toISOString().slice(0, 10));
    }
    const windowDaysSet = new Set(windowDays);

    // Track occupied hours per day (only within the 31-day window)
    const occupiedHoursPerDay = new Map<string, Set<number>>();
    for (const s of futureSlots) {
      const day = s.slice(0, 10);
      if (!windowDaysSet.has(day)) continue;
      if (!occupiedHoursPerDay.has(day)) occupiedHoursPerDay.set(day, new Set());
      occupiedHoursPerDay.get(day)!.add(parseInt(s.slice(11, 13), 10));
    }

    // Build day pool ordered by pass tier: days with fewer existing posts come first.
    // Each pass = one post per day at a different hour. maxPostsPerDay = number of
    // optimal hours available for this niche.
    const maxPostsPerDay = resolvedHours.length;
    const dayPool: string[] = [];
    for (let pass = 0; pass < maxPostsPerDay; pass++) {
      for (const day of windowDays) {
        if ((occupiedHoursPerDay.get(day)?.size ?? 0) === pass) {
          dayPool.push(day);
        }
      }
    }

    // batchIndex selects the Nth day — concurrent batch photos each claim a unique day
    const batchIndex = typeof body.batchIndex === "number" && body.batchIndex >= 0 ? body.batchIndex : 0;
    const targetDate = dayPool[batchIndex] ?? dayPool[dayPool.length - 1] ?? windowDays[0];

    // Hour is always from photo content; fallback to resolvedHours rotation only when ambiguous.
    // If the preferred hour is already taken on targetDate, try alternatives on the same day.
    const contentHour = pickHourFromContent(imageAnalysis);
    const preferredHour = contentHour ?? resolvedHours[batchIndex % resolvedHours.length];
    const occupiedHoursOnDay = occupiedHoursPerDay.get(targetDate) ?? new Set<number>();
    const candidateHours = Array.from(new Set([preferredHour, ...resolvedHours, 7, 12, 18, 21]));
    const finalHour = candidateHours.find((h) => !occupiedHoursOnDay.has(h)) ?? preferredHour;

    const passNumber = (occupiedHoursOnDay.size) + 1;
    console.log(
      `[Scheduler] niche="${profile.niche}" imageCtx="${imageAnalysis.context}" themes=${JSON.stringify(imageAnalysis.suggestedThemes)} contentHour=${contentHour ?? "null"} batchIndex=${batchIndex} targetDate=${targetDate} pass=${passNumber} preferredHour=${preferredHour} finalHour=${finalHour} dayPool=${dayPool.length}`,
    );

    const scheduledAtDate = new Date(targetDate + "T00:00:00Z");
    scheduledAtDate.setUTCHours(finalHour, 0, 0, 0);
    const computedScheduledAt = scheduledAtDate.toISOString();

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
        scheduledAt: computedScheduledAt,
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
