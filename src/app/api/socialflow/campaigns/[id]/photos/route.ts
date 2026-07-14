export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { env } from "@/lib/cf";
import {
  SocialContextError,
  resolveSocialContext,
  getFutureScheduledSlots,
  getSaasSocialCampaignById,
} from "@/lib/socialflow/repository";
import { SocialFlowOrchestrator } from "@/lib/socialflow/ai/SocialFlowOrchestrator";
import { ImageAnalysisAgent } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";
import type { ImageAnalysis } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";
import { TrendAgent } from "@/lib/socialflow/ai/agents/TrendAgent";
import { ContentGeneratorAgent } from "@/lib/socialflow/ai/agents/ContentGeneratorAgent";
import { pickOpenerCategory, isGraphicTextContent } from "@/lib/socialflow/ai/openers/pickOpenerCategory";
import { OptimizationAgent } from "@/lib/socialflow/ai/agents/OptimizationAgent";
import type { KeywordEngineOutput, StrategyItem } from "@/lib/socialflow/ai/types";
import { isActiveSocialFlowTrial } from "@/lib/socialflow/billing/enforce";

// This endpoint is the campaign-aware sibling of /api/socialflow/posts/generate-from-image —
// same per-photo LLaVA + Mistral pipeline, but (a) it narrates every photo inside the campaign's
// name/objective/notes, (b) it forces one shared hashtag for the whole campaign, and (c) its
// scheduling never leaves the campaign's [startDate, endDate] window (the individual-photo
// endpoint has no such window and rolls over into future months instead).

function unauthorizedResponse() {
  return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
}

// Text normalized the same way every classifier below needs it: lowercase, accents stripped.
function normalizeAnalysisText(analysis: ImageAnalysis): string {
  const raw = [analysis.description, analysis.context].join(" ");
  return raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Same hour-from-content heuristic as the individual-photo endpoint (see that file for the
// full rationale) — kept identical so a campaign's photos read consistently with standalone ones.
function pickHourFromContent(analysis: ImageAnalysis): number | null {
  const text = normalizeAnalysisText(analysis);
  if (/ensalada|receta|cocin|\bplato\b|\bcomer\b|ingredi|bebida|batido|\bjugo\b/.test(text)) return 12;
  if (/dormir|\bcama\b|meditaci|\byoga\b|respirar|\bnoche\b|\bsueno\b/.test(text)) return 21;
  if (isGraphicTextContent(analysis)) return 18;
  return null;
}

function cleanOpening(text: string): string {
  return text
    .replace(
      /^[¡!]*\s*(hola|hey|buenas?(?:\s+(?:d[ií]as?|tardes?|noches?))?|buenos\s+d[ií]as?)\b[^a-záéíóúüñ\n]*/i,
      "",
    )
    .replace(/^chicas?\s*[!,.\s¡]*/i, "")
    .replace(/^a\s+veces\s*[,.\s]*/i, "")
    .trimStart();
}

// Deterministic, campaign-wide hashtag so every photo of the same campaign shares one tag
// (e.g. campaign "Lanzamiento Q3" → "#LanzamientoQ3").
function campaignHashtagFor(campaignName: string): string {
  const slug = campaignName
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 30);
  return slug ? `#${slug}` : "";
}

// [startStr, endStr] inclusive, one entry per calendar day (UTC). Falls back to a single
// day if the range is empty/inverted (defensive — shouldn't happen with valid campaign dates).
function buildDateRange(startStr: string, endStr: string): string[] {
  const days: string[] = [];
  let cursor = new Date(startStr + "T00:00:00Z").getTime();
  const endMs = new Date(endStr + "T00:00:00Z").getTime();
  while (cursor <= endMs) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 86_400_000;
  }
  return days.length > 0 ? days : [startStr];
}

const DEFAULT_CAMPAIGN_WINDOW_DAYS = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await params;

    const body = (await request.json().catch(() => null)) as {
      imageUrl?: string;
      imageKey?: string;
      saasId?: string;
      provider?: string;
      batchIndex?: number;
      scheduleIndex?: number;
      mode?: "analyze" | "finalize";
      imageAnalysis?: ImageAnalysis;
    } | null;

    if (!body?.imageUrl || !body?.imageKey || !body?.saasId) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "imageUrl, imageKey and saasId are required" },
        { status: 400 },
      );
    }

    const session = await requireCurrentSocialFlowSession(request);
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: body.saasId });

    const campaign = await getSaasSocialCampaignById(ctx, campaignId);
    if (!campaign) {
      return NextResponse.json({ code: "CAMPAIGN_NOT_FOUND", message: "Campaign not found" }, { status: 404 });
    }

    // Build full brand profile (includes KB context, same as orchestrator)
    const orchestrator = new SocialFlowOrchestrator();
    const profile = await orchestrator.buildProfile({
      tenantId: session.tenantId,
      saasId: body.saasId,
      niche: "",
      tone: "",
      frequencyPerWeek: 1,
      accountType: session.accountType,
    });

    if (profile.accountType === "empresa") {
      profile.voiceInstruction = `Escribe en tercera persona hablando de "${profile.brandIdentity}" como marca/entidad. NUNCA uses "yo", "mi", "me" ni "mis". Ejemplos correctos: "${profile.brandIdentity} presenta...", "En ${profile.brandIdentity} encontrarás...", "Nuestro equipo...". Ejemplo incorrecto: "Te comparto...".`;
    } else if (!profile.voiceInstruction) {
      profile.voiceInstruction = `Escribe en primera persona singular (yo). Habla directamente como si fueras ${profile.brandIdentity} dirigiéndote a tu audiencia. NUNCA uses "${profile.brandIdentity}" en tercera persona ni como si fuera una empresa. Ejemplo correcto: "Te comparto..." — Ejemplo incorrecto: "En ${profile.brandIdentity} compartimos..."`;
    }

    let imageAnalysis: ImageAnalysis;
    if (body.imageAnalysis) {
      imageAnalysis = body.imageAnalysis;
    } else {
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
      imageAnalysis = await new ImageAnalysisAgent().run({ imageBytes, profile });
    }

    // "analyze" mode: classification only, identical to the individual-photo endpoint —
    // used by the upload UI to learn every photo's content type before deciding order.
    if (body.mode === "analyze") {
      return NextResponse.json({
        imageAnalysis,
        contentCategory: isGraphicTextContent(imageAnalysis) ? "grafico_texto" : "foto_real",
      });
    }

    const [trends, isTrial] = await Promise.all([
      new TrendAgent().run({ profile }),
      isActiveSocialFlowTrial(session.tenantId, session.role),
    ]);

    // Campaign narrative — derived in caliente from name + objective + notes (no new DB column),
    // folded into the strategy item's angle so ContentGeneratorAgent narrates every photo inside it.
    const campaignContext = `Campaña "${campaign.name}"${campaign.objective ? `, objetivo: ${campaign.objective}` : ""}${campaign.notes?.trim() ? ` — ${campaign.notes.trim()}` : ""}`;
    const baseAngle = imageAnalysis.suggestedThemes[0] ?? profile.niche;

    const strategyItem: StrategyItem = {
      id: `campaign_img_${Date.now()}`,
      dayOffset: 0,
      theme: imageAnalysis.context,
      angle: `${baseAngle} — dentro de ${campaignContext}`,
      format:
        imageAnalysis.recommendedPostType === "REEL"
          ? "reel"
          : imageAnalysis.recommendedPostType === "STORY"
          ? "story"
          : "single",
      callToAction: profile.primaryCTA || "Conoce más en el enlace de la bio.",
    };

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
      trendingHashtags: [
        ...trends.trendingTopics.map((t) => `#${t.replace(/\s+/g, "").replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9]/g, "").toLowerCase()}`),
        ...imageThemeHashtags,
      ].filter((h) => h.length > 2).slice(0, 10),
      nicheHashtags: profile.competitorHashtags.slice(0, 5),
      viralHashtags: profile.viralThemes.map((t) => `#${t.replace(/\s+/g, "").toLowerCase()}`),
      campaignHashtags: profile.priorityHashtags,
    };

    const contentAgent = new ContentGeneratorAgent();
    const openerCategory = pickOpenerCategory(imageAnalysis, strategyItem.theme);
    const generated = await contentAgent.run({
      profile,
      strategyItem,
      keywordEngine,
      trends,
      openerIndex: (body.batchIndex ?? 0) % 10,
      openerCategory,
      specificContext: imageAnalysis.specificContext,
    });
    const variant = generated.variants[0];

    const optimizationAgent = new OptimizationAgent();
    const optimized = await optimizationAgent.run({ profile, variant, keywordEngine });

    optimized.improvedText = cleanOpening(optimized.improvedText);

    if (optimized.hashtags.length < 10) {
      const themeHashtags = imageAnalysis.suggestedThemes
        .map((t) => "#" + t.replace(/\s+/g, "").replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9]/g, ""))
        .filter((h) => h.length > 2);
      const supplementPool = [
        ...optimized.hashtags,
        ...themeHashtags,
        ...(profile.competitorHashtags ?? []),
        ...(profile.priorityHashtags ?? []),
        ...(profile.baseHashtags ?? []),
      ];
      optimized.hashtags = Array.from(new Set(supplementPool)).filter(Boolean).slice(0, 15);
    }

    // Coordinate hashtags across the whole campaign batch: every post from this campaign
    // always carries this one shared tag, regardless of what the LLM returned.
    const campaignHashtag = campaignHashtagFor(campaign.name);
    if (campaignHashtag && !optimized.hashtags.includes(campaignHashtag)) {
      optimized.hashtags = [campaignHashtag, ...optimized.hashtags].slice(0, 15);
    }

    // Scheduling bounded to the campaign's own window — unlike the individual-photo endpoint,
    // this never rolls over into future months beyond campaign.endDate.
    const todayUtc = new Date().toISOString().slice(0, 10);
    const rangeStartStr = campaign.startDate && campaign.startDate > todayUtc ? campaign.startDate : todayUtc;
    const rangeEndStr =
      campaign.endDate ??
      new Date(new Date(rangeStartStr + "T00:00:00Z").getTime() + DEFAULT_CAMPAIGN_WINDOW_DAYS * 86_400_000)
        .toISOString()
        .slice(0, 10);
    const rangeDays = buildDateRange(rangeStartStr, rangeEndStr);
    const rangeDaysSet = new Set(rangeDays);

    const futureSlots = await getFutureScheduledSlots(ctx).catch(() => [] as string[]);
    const occupiedHoursPerDay = new Map<string, Set<number>>();
    for (const s of futureSlots) {
      const day = s.slice(0, 10);
      if (!rangeDaysSet.has(day)) continue;
      if (!occupiedHoursPerDay.has(day)) occupiedHoursPerDay.set(day, new Set());
      occupiedHoursPerDay.get(day)!.add(parseInt(s.slice(11, 13), 10));
    }

    const MAX_POSTS_PER_DAY = isTrial ? 1 : 3;
    let currentPass = MAX_POSTS_PER_DAY;
    for (let p = 0; p < MAX_POSTS_PER_DAY; p++) {
      if (rangeDays.some((day) => (occupiedHoursPerDay.get(day)?.size ?? 0) === p)) {
        currentPass = p + 1;
        break;
      }
    }
    // Day pool = days at the current pass level. If the whole campaign window is already
    // saturated at MAX_POSTS_PER_DAY, fall back to scheduleIndex rotation over the full range
    // (stacking beyond the cap) instead of rolling over past campaign.endDate.
    const dayPool = rangeDays.filter((day) => (occupiedHoursPerDay.get(day)?.size ?? 0) === currentPass - 1);

    const scheduleIndex =
      typeof body.scheduleIndex === "number" && body.scheduleIndex >= 0
        ? body.scheduleIndex
        : typeof body.batchIndex === "number" && body.batchIndex >= 0
        ? body.batchIndex
        : 0;
    const targetDate = dayPool.length > 0 ? dayPool[scheduleIndex % dayPool.length] : rangeDays[scheduleIndex % rangeDays.length];

    const FITNESS_RE = /fitness|lifestyle|wellness|salud|health|gym|sport|yoga|pilates|nutrici|coach|entrenami|ejercici/i;
    const nicheHours = FITNESS_RE.test(profile.niche) ? [7, 12, 18] : [9, 18];
    const aiHours = (trends.optimalHours ?? []).filter((h) => Number.isInteger(h) && h >= 0 && h < 24).slice(0, 3);
    const resolvedHours = aiHours.length >= 2 ? aiHours : nicheHours;

    const contentHour = pickHourFromContent(imageAnalysis);
    const contentHourCandidates: number[] =
      contentHour === 12 ? [12, 13, 11] :
      contentHour === 21 ? [21, 20, 22] :
      contentHour === 18 ? [18, 17, 19] :
      (() => {
        const idx = scheduleIndex % resolvedHours.length;
        return [...resolvedHours.slice(idx), ...resolvedHours.slice(0, idx)];
      })();

    const occupiedHoursOnDay = occupiedHoursPerDay.get(targetDate) ?? new Set<number>();
    const nowHourUtc = new Date().getUTCHours();
    const finalHour =
      contentHourCandidates.find(
        (h) => !occupiedHoursOnDay.has(h) && (targetDate !== todayUtc || h > nowHourUtc),
      ) ??
      contentHourCandidates.find((h) => !occupiedHoursOnDay.has(h)) ??
      contentHourCandidates[0];

    const scheduledAtDate = new Date(targetDate + "T00:00:00Z");
    scheduledAtDate.setUTCHours(finalHour, 0, 0, 0);
    const computedScheduledAt = scheduledAtDate.toISOString();

    const provider = body.provider ?? "INSTAGRAM";
    const contentTypeMap: Record<string, "FEED" | "REEL" | "STORY"> = { REEL: "REEL", STORY: "STORY", FEED: "FEED" };
    const contentType = contentTypeMap[imageAnalysis.recommendedPostType] ?? "FEED";
    const title = optimized.improvedText.split("\n")[0]?.replace(/^#+\s*/, "").slice(0, 72).trim() ?? strategyItem.theme;

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
        campaignId: campaign.id,
      },
    });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return unauthorizedResponse();
    }
    console.error("SOCIALFLOW_CAMPAIGN_GENERATE_FROM_IMAGE_ERROR", error);
    return NextResponse.json(
      { code: "SOCIALFLOW_ERROR", message: "Unable to generate post from image for this campaign" },
      { status: 500 },
    );
  }
}
