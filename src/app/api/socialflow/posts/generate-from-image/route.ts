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
  const raw = [analysis.description, analysis.context].join(" ");
  const text = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Food — words exclusive to food content; won't appear in typical exercise descriptions
  if (/ensalada|receta|cocin|\bplato\b|\bcomer\b|ingredi|bebida|batido|\bjugo\b/.test(text)) return 12;

  // Rest / sleep — words exclusive to rest content
  if (/dormir|\bcama\b|meditaci|\byoga\b|respirar|\bnoche\b|\bsueno\b/.test(text)) return 21;

  // Motivation — only when photo is clearly text/typography based (quote card, etc.)
  if (/\bfrase|\bcita\b|\btexto\b|\bquote\b|letras|tipografi/.test(text)) return 18;

  // Exercise is NOT detected by keyword: LLaVA mentions exercise terms in nearly all
  // fitness-niche photos regardless of actual content. Caller uses batchIndex rotation.
  return null;
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
    console.log(
      `[ImageAnalysis] description="${imageAnalysis.description}" context="${imageAnalysis.context}" themes=${JSON.stringify(imageAnalysis.suggestedThemes)}`,
    );

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

    // Step 7: Calculate best schedule slot — sequential pass system within current month.
    // Pass 1 is active while any day of the month has 0 posts.
    // Pass 2 activates only when ALL days have ≥1 post; adds a 2nd post per day.
    // Pass 3 activates only when ALL days have ≥2 posts. Maximum 3 posts per day.
    // The HOUR is always derived from pickHourFromContent — passes determine the DAY only.
    const DAY_MS = 86_400_000;
    const todayUtc = new Date().toISOString().slice(0, 10);

    const socialCtx = await resolveSocialContext({ tenantId: session.tenantId, saasId: body.saasId });
    const futureSlots = await getFutureScheduledSlots(socialCtx).catch(() => [] as string[]);

    // Resolve niche/AI hour pool (used as fallback when content type is ambiguous)
    const FITNESS_RE = /fitness|lifestyle|wellness|salud|health|gym|sport|yoga|pilates|nutrici|coach|entrenami|ejercici/i;
    const nicheHours = FITNESS_RE.test(profile.niche) ? [7, 12, 18] : [9, 18];
    const aiHours = (trends.optimalHours ?? []).filter((h) => Number.isInteger(h) && h >= 0 && h < 24).slice(0, 3);
    const resolvedHours = aiHours.length >= 2 ? aiHours : nicheHours;

    // Build window: 30-day rolling window starting today (ignores month boundaries)
    const todayMs = new Date(todayUtc + "T00:00:00Z").getTime();
    const windowDays: string[] = [];
    for (let i = 0; i < 30; i++) {
      windowDays.push(new Date(todayMs + i * DAY_MS).toISOString().slice(0, 10));
    }
    const windowDaysSet = new Set(windowDays);

    // Track occupied hours per day (only within the current month window)
    const occupiedHoursPerDay = new Map<string, Set<number>>();
    for (const s of futureSlots) {
      const day = s.slice(0, 10);
      if (!windowDaysSet.has(day)) continue;
      if (!occupiedHoursPerDay.has(day)) occupiedHoursPerDay.set(day, new Set());
      occupiedHoursPerDay.get(day)!.add(parseInt(s.slice(11, 13), 10));
    }

    // Determine current pass: advance only when ALL days of the month are filled.
    // Pass 1 while any day has 0 posts. Pass 2 when all have ≥1. Pass 3 when all have ≥2.
    const MAX_POSTS_PER_DAY = 3;
    let currentPass = MAX_POSTS_PER_DAY; // default: month fully saturated at all passes
    for (let p = 0; p < MAX_POSTS_PER_DAY; p++) {
      if (windowDays.some((day) => (occupiedHoursPerDay.get(day)?.size ?? 0) === p)) {
        currentPass = p + 1;
        break;
      }
    }

    // Day pool = only days at the current pass level (exactly currentPass-1 existing posts)
    const dayPool = windowDays.filter(
      (day) => (occupiedHoursPerDay.get(day)?.size ?? 0) === currentPass - 1,
    );

    // batchIndex selects the Nth day; cycles within pool if batch has more photos than days
    const batchIndex = typeof body.batchIndex === "number" && body.batchIndex >= 0 ? body.batchIndex : 0;
    const targetDate = dayPool.length > 0 ? dayPool[batchIndex % dayPool.length] : windowDays[0];

    // Hour selection: content-specific when LLaVA clearly identifies the type,
    // otherwise batchIndex picks the starting hour from the optimal pool so each
    // photo in a batch gets a different hour (0→pool[0], 1→pool[1], etc.).
    const contentHour = pickHourFromContent(imageAnalysis);
    const contentHourCandidates: number[] =
      contentHour === 12 ? [12, 13, 11] :
      contentHour === 21 ? [21, 20, 22] :
      contentHour === 18 ? [18, 17, 19] :
      (() => {
        // Rotate resolvedHours so batchIndex N starts at resolvedHours[N % length]
        const idx = batchIndex % resolvedHours.length;
        return [...resolvedHours.slice(idx), ...resolvedHours.slice(0, idx)];
      })();

    const occupiedHoursOnDay = occupiedHoursPerDay.get(targetDate) ?? new Set<number>();
    const finalHour = contentHourCandidates.find((h) => !occupiedHoursOnDay.has(h))
      ?? contentHourCandidates[0];

    console.log(
      `[Scheduler] niche="${profile.niche}" imageCtx="${imageAnalysis.context}" themes=${JSON.stringify(imageAnalysis.suggestedThemes)} contentHour=${contentHour ?? "null"} batchIndex=${batchIndex} targetDate=${targetDate} pass=${currentPass} finalHour=${finalHour} dayPool=${dayPool.length}/${windowDays.length}`,
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
