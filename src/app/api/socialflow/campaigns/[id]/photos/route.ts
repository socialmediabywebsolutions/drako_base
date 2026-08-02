export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { env } from "@/lib/cf";
import {
  SocialContextError,
  resolveSocialContext,
  getFutureScheduledSlots,
  getSaasSocialCampaignById,
  type SocialContext,
} from "@/lib/socialflow/repository";
import { SocialFlowOrchestrator } from "@/lib/socialflow/ai/SocialFlowOrchestrator";
import { ImageAnalysisAgent } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";
import type { ImageAnalysis } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";
import { TrendAgent, type TrendInsights } from "@/lib/socialflow/ai/agents/TrendAgent";
import { ContentGeneratorAgent } from "@/lib/socialflow/ai/agents/ContentGeneratorAgent";
import { pickOpenerCategory, isGraphicTextContent } from "@/lib/socialflow/ai/openers/pickOpenerCategory";
import { cleanOpening } from "@/lib/socialflow/ai/openers/cleanOpening";
import { OptimizationAgent } from "@/lib/socialflow/ai/agents/OptimizationAgent";
import { CarouselComposerAgent } from "@/lib/socialflow/ai/agents/CarouselComposerAgent";
import { CAROUSEL_MIN_ITEMS } from "@/lib/socialflow/meta/publishing";
import type { BrandProfile, KeywordEngineOutput, StrategyItem } from "@/lib/socialflow/ai/types";
import type { SaasSocialCampaign } from "@/lib/social-core/types";
import { isActiveSocialFlowTrial, getCarouselSlideLimit } from "@/lib/socialflow/billing/enforce";
import { calculateViralScore, mapContentTypeToViralFormat, type ViralScore } from "@/lib/socialflow/intelligence/ViralScoreAgent";

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

// Deterministic, campaign-wide hashtag so every photo of the same campaign shares one tag
// (e.g. campaign "Lanzamiento Q3" → "#LanzamientoQ3").
function campaignHashtagFor(campaignName: string): string {
  const slug = campaignName
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 30);
  return slug ? `#${slug}` : "";
}

// Fase 2 (+ Fase 5, carrusel) — asigna FEED/REEL/STORY/CAROUSEL en bloques según la
// mezcla planeada de la campaña (post_count/reel_count/historia_count/carousel_count),
// repitiendo el ciclo cada `total` fotos para que un lote más grande que la mezcla
// planeada no se quede sin formato. Determinista y sin estado compartido: cada foto se
// sube en su propia request, así que la única forma de que todas coincidan en la misma
// mezcla es derivarla siempre del mismo índice.
function pickContentTypeFromMix(
  index: number,
  counts: { FEED: number; REEL: number; STORY: number; CAROUSEL: number },
): "FEED" | "REEL" | "STORY" | "CAROUSEL" | null {
  const total = counts.FEED + counts.REEL + counts.STORY + counts.CAROUSEL;
  if (total <= 0) return null;
  const position = index % total;
  if (position < counts.FEED) return "FEED";
  if (position < counts.FEED + counts.REEL) return "REEL";
  if (position < counts.FEED + counts.REEL + counts.STORY) return "STORY";
  return "CAROUSEL";
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

// Extraído del bloque original (que solo conocía 1 foto) para reutilizarlo tanto desde
// el flujo singular como desde el nuevo flujo de carrusel (N fotos, scheduleIndex por
// lote). Comportamiento IDÉNTICO al bloque que reemplaza — solo se parametriza
// representativeAnalysis (antes siempre era la única imageAnalysis disponible).
async function computeCampaignScheduledSlot(input: {
  ctx: SocialContext;
  campaign: SaasSocialCampaign;
  representativeAnalysis: ImageAnalysis;
  scheduleIndex: number;
  profile: BrandProfile;
  trends: TrendInsights;
  isTrial: boolean;
}): Promise<string> {
  const { ctx, campaign, representativeAnalysis, scheduleIndex, profile, trends, isTrial } = input;
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
  const dayPool = rangeDays.filter((day) => (occupiedHoursPerDay.get(day)?.size ?? 0) === currentPass - 1);
  const targetDate = dayPool.length > 0 ? dayPool[scheduleIndex % dayPool.length] : rangeDays[scheduleIndex % rangeDays.length];

  const FITNESS_RE = /fitness|lifestyle|wellness|salud|health|gym|sport|yoga|pilates|nutrici|coach|entrenami|ejercici/i;
  const nicheHours = FITNESS_RE.test(profile.niche) ? [7, 12, 18] : [9, 18];
  const aiHours = (trends.optimalHours ?? []).filter((h) => Number.isInteger(h) && h >= 0 && h < 24).slice(0, 3);
  const resolvedHours = aiHours.length >= 2 ? aiHours : nicheHours;

  const contentHour = pickHourFromContent(representativeAnalysis);
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
    contentHourCandidates.find((h) => !occupiedHoursOnDay.has(h) && (targetDate !== todayUtc || h > nowHourUtc)) ??
    contentHourCandidates.find((h) => !occupiedHoursOnDay.has(h)) ??
    contentHourCandidates[0];

  const scheduledAtDate = new Date(targetDate + "T00:00:00Z");
  scheduledAtDate.setUTCHours(finalHour, 0, 0, 0);
  return scheduledAtDate.toISOString();
}

type CarouselPhotoInput = { url: string; key: string; analysis?: ImageAnalysis };

// Agrupa en lotes de `size` (getCarouselSlideLimit del plan). El último lote, si queda
// por debajo de CAROUSEL_MIN_ITEMS (ej. 5 fotos con maxSlides=4 → lotes [4,1]), NO forma
// un carrusel válido — se separa como `leftover` para reportarse, nunca se descarta en
// silencio ni se fuerza dentro de otro lote (eso rompería el límite del plan).
function chunkCarouselPhotos(
  items: CarouselPhotoInput[],
  size: number,
): { chunks: CarouselPhotoInput[][]; leftover: CarouselPhotoInput[] } {
  const chunks: CarouselPhotoInput[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  const last = chunks[chunks.length - 1];
  if (last && last.length < CAROUSEL_MIN_ITEMS) {
    chunks.pop();
    return { chunks, leftover: last };
  }
  return { chunks, leftover: [] };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await params;

    const body = (await request.json().catch(() => null)) as {
      imageUrl?: string;
      imageKey?: string;
      imageUrls?: string[];             // CAROUSEL only — mismo contrato que generate-from-image
      imageKeys?: string[];             // CAROUSEL only
      imageAnalyses?: ImageAnalysis[];  // CAROUSEL only — reusa análisis ya cacheados por foto
      saasId?: string;
      provider?: string;
      batchIndex?: number;
      scheduleIndex?: number;
      mode?: "analyze" | "finalize";
      imageAnalysis?: ImageAnalysis;
    } | null;

    const isCarouselRequest = Array.isArray(body?.imageUrls) && Array.isArray(body?.imageKeys);

    if (!body?.saasId) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "imageUrl, imageKey and saasId are required" },
        { status: 400 },
      );
    }
    if (isCarouselRequest) {
      const urls = body.imageUrls!;
      const keys = body.imageKeys!;
      if (urls.length !== keys.length || urls.length < CAROUSEL_MIN_ITEMS) {
        return NextResponse.json(
          { code: "INVALID_CAROUSEL_BODY", message: `imageUrls and imageKeys must be equal-length arrays of at least ${CAROUSEL_MIN_ITEMS} items` },
          { status: 400 },
        );
      }
    } else if (!body.imageUrl || !body.imageKey) {
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
      campaignId,
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

    // ── Rama carrusel — N fotos agrupadas en 1+ lotes, cada lote = 1 post CAROUSEL ──
    // Mismo pipeline que el carrusel individual (generate-from-image: análisis por foto +
    // CarouselComposerAgent), pero con el hashtag compartido de campaña y el scheduling
    // acotado a la ventana [startDate, endDate]. maxSlides sigue el plan del tenant, no
    // el límite duro de Instagram (CAROUSEL_MAX_ITEMS=10) — más restrictivo siempre.
    if (isCarouselRequest) {
      const maxSlides = await getCarouselSlideLimit(session.tenantId, session.role);
      if (maxSlides < CAROUSEL_MIN_ITEMS) {
        return NextResponse.json(
          { code: "CAROUSEL_NOT_AVAILABLE_FOR_PLAN", message: "El plan actual no incluye el formato Carrusel." },
          { status: 403 },
        );
      }

      const imageUrls = body.imageUrls!;
      const imageKeys = body.imageKeys!;
      const providedAnalyses = body.imageAnalyses ?? [];
      const bucket = env()?.SOCIAL_MEDIA_BUCKET;

      const photos: CarouselPhotoInput[] = imageUrls.map((url, i) => ({
        url,
        key: imageKeys[i],
        analysis: providedAnalyses[i],
      }));
      const { chunks, leftover } = chunkCarouselPhotos(photos, maxSlides);

      const [trends, isTrial] = await Promise.all([
        new TrendAgent().run({ profile }),
        isActiveSocialFlowTrial(session.tenantId, session.role),
      ]);

      const campaignHashtag = campaignHashtagFor(campaign.name);
      const baseScheduleIndex =
        typeof body.scheduleIndex === "number" && body.scheduleIndex >= 0
          ? body.scheduleIndex
          : typeof body.batchIndex === "number" && body.batchIndex >= 0
          ? body.batchIndex
          : 0;

      const posts: Array<{
        title: string; body: string; hashtags: string[]; provider: string; contentType: "CAROUSEL";
        scheduledAt: string; saasId: string; campaignId: string;
        slides: { order: number; imageUrl: string; text: string; role: string }[];
      }> = [];
      const failedGroups: { chunkIndex: number; failedSlides: { order: number; imageKey: string; message: string }[] }[] = [];

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];

        const settled = await Promise.allSettled(
          chunk.map(async (item) => {
            if (item.analysis) return item.analysis;
            if (!bucket) throw new Error("STORAGE_NOT_CONFIGURED");
            const r2Object = await bucket.get(item.key);
            if (!r2Object) throw new Error("IMAGE_NOT_FOUND");
            const imageBytes = Array.from(new Uint8Array(await r2Object.arrayBuffer()));
            return new ImageAnalysisAgent().run({ imageBytes, profile });
          }),
        );

        const failedSlides = settled
          .map((result, order) => ({ result, order }))
          .filter((s): s is { result: PromiseRejectedResult; order: number } => s.result.status === "rejected")
          .map(({ result, order }) => ({
            order,
            imageKey: chunk[order].key,
            message: result.reason instanceof Error ? result.reason.message : String(result.reason),
          }));

        if (failedSlides.length > 0) {
          failedGroups.push({ chunkIndex, failedSlides });
          continue;
        }

        const imageAnalyses = (settled as PromiseFulfilledResult<ImageAnalysis>[]).map((r) => r.value);
        const openerCategory = pickOpenerCategory(imageAnalyses[0], imageAnalyses[0].context);

        const allThemes = Array.from(new Set(imageAnalyses.flatMap((a) => a.suggestedThemes)));
        const imageThemeHashtags = allThemes
          .map((t) => `#${t.replace(/\s+/g, "").replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9]/g, "").toLowerCase()}`)
          .filter((h) => h.length > 2);
        const keywordEngine: KeywordEngineOutput = {
          clusters: profile.contentPillars.slice(0, 3).map((pillar, i) => ({
            cluster: pillar,
            intent: (["awareness", "consideration", "conversion"] as const)[i % 3],
            difficulty: "medium" as const,
            trendScore: 70,
            seasonality: null,
            contentAngles: allThemes,
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

        const slideContexts = imageAnalyses.map((a, i) => ({ order: i, specificContext: a.specificContext }));
        const composition = await new CarouselComposerAgent().run({ profile, keywordEngine, trends, openerCategory, slideContexts });

        let hashtags = composition.hashtags;
        if (campaignHashtag && !hashtags.includes(campaignHashtag)) {
          hashtags = [campaignHashtag, ...hashtags].slice(0, 15);
        }

        const chunkScheduleIndex = baseScheduleIndex + chunkIndex;
        const computedScheduledAt = await computeCampaignScheduledSlot({
          ctx, campaign, representativeAnalysis: imageAnalyses[0], scheduleIndex: chunkScheduleIndex, profile, trends, isTrial,
        });

        posts.push({
          title: composition.slides[0]?.text.slice(0, 72) ?? imageAnalyses[0].context,
          body: composition.slides.map((s) => s.text).join("\n\n"),
          hashtags,
          provider: body.provider ?? "INSTAGRAM",
          contentType: "CAROUSEL",
          scheduledAt: computedScheduledAt,
          saasId: body.saasId,
          campaignId: campaign.id,
          slides: composition.slides.map((slide, i) => ({ order: slide.order, imageUrl: chunk[i].url, text: slide.text, role: slide.role })),
        });
      }

      if (posts.length === 0) {
        return NextResponse.json(
          {
            code: "CAROUSEL_BATCH_FAILED",
            message: "No se pudo generar ningún carrusel de este lote.",
            failedGroups,
            ...(leftover.length > 0 ? { skippedImages: leftover.map((p) => ({ imageUrl: p.url, imageKey: p.key })) } : {}),
          },
          { status: 422 },
        );
      }

      return NextResponse.json({
        suggestedCarouselPosts: posts,
        ...(leftover.length > 0 ? { skippedImages: leftover.map((p) => ({ imageUrl: p.url, imageKey: p.key })) } : {}),
        ...(failedGroups.length > 0 ? { failedGroups } : {}),
      });
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
      const r2Object = await bucket.get(body.imageKey!);
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
      llavaSuggestedFormat: imageAnalysis.recommendedPostType,
      momentType: imageAnalysis.momentType,
      tenantId: session.tenantId,
      saasId: body.saasId,
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

    const scheduleIndex =
      typeof body.scheduleIndex === "number" && body.scheduleIndex >= 0
        ? body.scheduleIndex
        : typeof body.batchIndex === "number" && body.batchIndex >= 0
        ? body.batchIndex
        : 0;

    const computedScheduledAt = await computeCampaignScheduledSlot({
      ctx, campaign, representativeAnalysis: imageAnalysis, scheduleIndex, profile, trends, isTrial,
    });

    const provider = body.provider ?? "INSTAGRAM";
    const contentTypeMap: Record<string, "FEED" | "REEL" | "STORY"> = { REEL: "REEL", STORY: "STORY", FEED: "FEED" };
    const mixContentType = pickContentTypeFromMix(scheduleIndex, {
      FEED: campaign.postCount ?? 0,
      REEL: campaign.reelCount ?? 0,
      STORY: campaign.historiaCount ?? 0,
      CAROUSEL: campaign.carouselCount ?? 0,
    });
    // Una foto sola NUNCA se convierte en "carrusel" de 1 slide — agrupar N fotos es la
    // rama de arriba (isCarouselRequest). Si el mix asigna esta posición a CAROUSEL pero
    // el caller mandó una sola foto (todavía no agrupa — campaign-photo-batch.tsx sigue
    // sin tocar), cae de vuelta al formato sugerido por LLaVA.
    const contentType =
      mixContentType && mixContentType !== "CAROUSEL" ? mixContentType : contentTypeMap[variant.recommendedPostType] ?? "FEED";
    const title = optimized.improvedText.split("\n")[0]?.replace(/^#+\s*/, "").slice(0, 72).trim() ?? strategyItem.theme;

    // Score viral — mismo criterio que posts/generate-from-image: nunca debe
    // romper este endpoint, calculateViralScore ya degrada a un score neutro
    // internamente, y este try/catch es defensa adicional en el punto de
    // integración.
    let viralScore: ViralScore | null = null;
    const dracoEnvForScore = env();
    if (dracoEnvForScore) {
      try {
        viralScore = await calculateViralScore({
          caption: optimized.improvedText,
          hashtags: optimized.hashtags,
          format: mapContentTypeToViralFormat(contentType),
          niche: profile.niche,
          tenantId: session.tenantId,
          saasId: body.saasId,
          env: dracoEnvForScore,
        });
      } catch (err) {
        console.error("[campaigns/photos] calculateViralScore failed", err instanceof Error ? err.message : String(err));
        viralScore = null;
      }
    }

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
        viralScore,
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
