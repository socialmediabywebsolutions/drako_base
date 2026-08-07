export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { env } from "@/lib/cf";
import { SocialContextError, resolveSocialContext, getFutureScheduledSlots, listSaasSocialPosts } from "@/lib/socialflow/repository";
import { SocialFlowOrchestrator } from "@/lib/socialflow/ai/SocialFlowOrchestrator";
import { ImageAnalysisAgent } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";
import type { ImageAnalysis } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";
import { TrendAgent, type TrendInsights } from "@/lib/socialflow/ai/agents/TrendAgent";
import { ContentGeneratorAgent } from "@/lib/socialflow/ai/agents/ContentGeneratorAgent";
import { pickOpenerCategory, isGraphicTextContent } from "@/lib/socialflow/ai/openers/pickOpenerCategory";
import { cleanOpening } from "@/lib/socialflow/ai/openers/cleanOpening";
import { OptimizationAgent } from "@/lib/socialflow/ai/agents/OptimizationAgent";
import { CarouselComposerAgent, CarouselGenerationFailedError } from "@/lib/socialflow/ai/agents/CarouselComposerAgent";
import { CAROUSEL_MIN_ITEMS, CAROUSEL_MAX_ITEMS } from "@/lib/socialflow/meta/publishing";
import type { BrandProfile, KeywordEngineOutput, StrategyItem } from "@/lib/socialflow/ai/types";
import { isActiveSocialFlowTrial } from "@/lib/socialflow/billing/enforce";
import { calculateViralScore, mapContentTypeToViralFormat, type ViralScore } from "@/lib/socialflow/intelligence/ViralScoreAgent";

function unauthorizedResponse() {
  return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
}

// Text normalized the same way every classifier below needs it: lowercase, accents stripped.
function normalizeAnalysisText(analysis: ImageAnalysis): string {
  const raw = [analysis.description, analysis.context].join(" ");
  return raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Map photo content (from LLaVA analysis) to the best UTC posting hour.
// Returns null when the content is ambiguous — caller falls back to batchIndex rotation.
// Hour rationale (fitness/lifestyle niche, Spain+LatAm audience UTC):
//   7h  — workout content: people check Instagram before/after morning training
//  12h  — food/nutrition: people browse during lunch break
//  18h  — motivation/mindset: people decompress after work
//  21h  — rest/recovery: evening wind-down browsing
function pickHourFromContent(analysis: ImageAnalysis): number | null {
  const text = normalizeAnalysisText(analysis);

  // Food — words exclusive to food content; won't appear in typical exercise descriptions
  if (/ensalada|receta|cocin|\bplato\b|\bcomer\b|ingredi|bebida|batido|\bjugo\b/.test(text)) return 12;

  // Rest / sleep — words exclusive to rest content
  if (/dormir|\bcama\b|meditaci|\byoga\b|respirar|\bnoche\b|\bsueno\b/.test(text)) return 21;

  // Motivation — only when photo is clearly text/typography based (quote card, etc.)
  if (isGraphicTextContent(analysis)) return 18;

  // Exercise is NOT detected by keyword: LLaVA mentions exercise terms in nearly all
  // fitness-niche photos regardless of actual content. Caller uses batchIndex rotation.
  return null;
}

// Factorizado del Step 7 original (pases secuenciales, rollover de mes, selección de
// hora) para que tanto el flujo singular (FEED/REEL/STORY) como el branch CAROUSEL
// obtengan un scheduledAt real — sin fecha, la pieza no entra al calendario editorial.
// Comportamiento IDÉNTICO al bloque original; solo se parametrizan las variables que
// antes venían del closure (imageAnalysis → representativeAnalysis, etc).
async function computeScheduledSlot(input: {
  tenantId: string;
  saasId: string;
  profile: BrandProfile;
  trends: TrendInsights;
  isTrial: boolean;
  representativeAnalysis: ImageAnalysis;
  batchIndex?: number;
  scheduleIndex?: number;
  logLabel?: string;
}): Promise<string> {
  const { tenantId, saasId, profile, trends, isTrial, representativeAnalysis, batchIndex, logLabel } = input;

  // Pass 1 is active while any day of the month has 0 posts.
  // Pass 2 activates only when ALL days have ≥1 post; adds a 2nd post per day.
  // Pass 3 activates only when ALL days have ≥2 posts. Maximum 3 posts per day.
  // When a month is saturated at the max pass on every day, roll over to the next
  // calendar month (and beyond) instead of stacking posts on day 1.
  // The HOUR is always derived from pickHourFromContent — passes determine the DAY only.
  const todayUtc = new Date().toISOString().slice(0, 10);

  const socialCtx = await resolveSocialContext({ tenantId, saasId });
  const futureSlots = await getFutureScheduledSlots(socialCtx).catch(() => [] as string[]);

  // Resolve niche/AI hour pool (used as fallback when content type is ambiguous)
  const FITNESS_RE = /fitness|lifestyle|wellness|salud|health|gym|sport|yoga|pilates|nutrici|coach|entrenami|ejercici/i;
  const nicheHours = FITNESS_RE.test(profile.niche) ? [7, 12, 18] : [9, 18];
  const aiHours = (trends.optimalHours ?? []).filter((h) => Number.isInteger(h) && h >= 0 && h < 24).slice(0, 3);
  const resolvedHours = aiHours.length >= 2 ? aiHours : nicheHours;

  // Trial users are capped at 1 post/day so they don't consume more than Pass 1.
  const MAX_POSTS_PER_DAY = isTrial ? 1 : 3;

  // Every calendar day (UTC, "YYYY-MM-DD") of the month at `monthOffset` from today's
  // month. monthOffset 0 starts at today (never schedules into the past); monthOffset
  // > 0 covers the full month (1st through last day).
  function buildMonthDays(monthOffset: number): string[] {
    const today = new Date(todayUtc + "T00:00:00Z");
    const baseYear = today.getUTCFullYear();
    const baseMonth = today.getUTCMonth();
    const totalMonth = baseMonth + monthOffset;
    const targetYear = baseYear + Math.floor(totalMonth / 12);
    const targetMonth = ((totalMonth % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const startDay = monthOffset === 0 ? today.getUTCDate() : 1;
    const days: string[] = [];
    for (let d = startDay; d <= lastDay; d++) {
      days.push(new Date(Date.UTC(targetYear, targetMonth, d)).toISOString().slice(0, 10));
    }
    return days;
  }

  // Walk real calendar months (not a rolling 30-day window): if the current month is
  // saturated at MAX_POSTS_PER_DAY on every remaining day, roll over to the next month
  // (and the next, etc.) instead of stacking new posts on day 1.
  const MAX_MONTHS_AHEAD = 24;
  let windowDays: string[] = [];
  let occupiedHoursPerDay = new Map<string, Set<number>>();
  let currentPass = MAX_POSTS_PER_DAY;
  let dayPool: string[] = [];
  let monthOffsetUsed = 0;

  for (let monthOffset = 0; monthOffset < MAX_MONTHS_AHEAD; monthOffset++) {
    const monthDays = buildMonthDays(monthOffset);
    const monthDaysSet = new Set(monthDays);

    const monthOccupied = new Map<string, Set<number>>();
    for (const s of futureSlots) {
      const day = s.slice(0, 10);
      if (!monthDaysSet.has(day)) continue;
      if (!monthOccupied.has(day)) monthOccupied.set(day, new Set());
      monthOccupied.get(day)!.add(parseInt(s.slice(11, 13), 10));
    }

    // Determine current pass within this month: advance only when ALL its days are
    // filled. Pass 1 while any day has 0 posts. Pass 2 when all have ≥1. Pass 3 when
    // all have ≥2.
    let monthPass = MAX_POSTS_PER_DAY; // default: month fully saturated at all passes
    for (let p = 0; p < MAX_POSTS_PER_DAY; p++) {
      if (monthDays.some((day) => (monthOccupied.get(day)?.size ?? 0) === p)) {
        monthPass = p + 1;
        break;
      }
    }

    // Day pool = only days at the current pass level (exactly monthPass-1 existing posts)
    const monthDayPool = monthDays.filter(
      (day) => (monthOccupied.get(day)?.size ?? 0) === monthPass - 1,
    );

    windowDays = monthDays;
    occupiedHoursPerDay = monthOccupied;
    currentPass = monthPass;
    dayPool = monthDayPool;
    monthOffsetUsed = monthOffset;

    if (monthDayPool.length > 0) break; // found a month with room — stop here
    // else: this month is fully saturated at MAX_POSTS_PER_DAY every day — try next month
  }

  // scheduleIndex selects the Nth day (and rotates the starting hour). It defaults to
  // batchIndex (raw upload order) when the caller doesn't pass an interleaved index —
  // this keeps single-type batches and any caller that hasn't been updated unaffected.
  const scheduleIndex =
    typeof input.scheduleIndex === "number" && input.scheduleIndex >= 0
      ? input.scheduleIndex
      : typeof batchIndex === "number" && batchIndex >= 0
      ? batchIndex
      : 0;
  const targetDate = dayPool.length > 0 ? dayPool[scheduleIndex % dayPool.length] : windowDays[0];

  // Hour selection: content-specific when LLaVA clearly identifies the type,
  // otherwise scheduleIndex picks the starting hour from the optimal pool so each
  // photo in a batch gets a different hour (0→pool[0], 1→pool[1], etc.).
  const contentHour = pickHourFromContent(representativeAnalysis);
  const contentHourCandidates: number[] =
    contentHour === 12 ? [12, 13, 11] :
    contentHour === 21 ? [21, 20, 22] :
    contentHour === 18 ? [18, 17, 19] :
    (() => {
      // Rotate resolvedHours so scheduleIndex N starts at resolvedHours[N % length]
      const idx = scheduleIndex % resolvedHours.length;
      return [...resolvedHours.slice(idx), ...resolvedHours.slice(0, idx)];
    })();

  const occupiedHoursOnDay = occupiedHoursPerDay.get(targetDate) ?? new Set<number>();
  const nowHourUtc = new Date().getUTCHours();
  // Prefer a future hour today; fall back to any non-occupied hour; last resort: first candidate
  const finalHour =
    contentHourCandidates.find(
      (h) => !occupiedHoursOnDay.has(h) && (targetDate !== todayUtc || h > nowHourUtc),
    ) ??
    contentHourCandidates.find((h) => !occupiedHoursOnDay.has(h)) ??
    contentHourCandidates[0];

  console.log(
    `[Scheduler]${logLabel ? ` context=${logLabel}` : ""} niche="${profile.niche}" imageCtx="${representativeAnalysis.context}" themes=${JSON.stringify(representativeAnalysis.suggestedThemes)} contentHour=${contentHour ?? "null"} scheduleIndex=${scheduleIndex} targetDate=${targetDate} pass=${currentPass} monthOffset=${monthOffsetUsed} finalHour=${finalHour} dayPool=${dayPool.length}/${windowDays.length}`,
  );

  const scheduledAtDate = new Date(targetDate + "T00:00:00Z");
  scheduledAtDate.setUTCHours(finalHour, 0, 0, 0);
  return scheduledAtDate.toISOString();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      imageUrl?: string;
      imageKey?: string;
      imageUrls?: string[];             // CAROUSEL only — mismo orden que imageKeys
      imageKeys?: string[];             // CAROUSEL only
      imageAnalyses?: ImageAnalysis[];  // CAROUSEL only — mismo patrón que imageAnalysis singular: si el cliente ya
                                         // corrió "analyze" por foto, se pasa aquí para saltar la llamada a LLaVA de esa foto
      targetSlideCount?: number;        // CAROUSEL only — total de slides del carrusel (fotos + IA), típicamente
                                         // maxSlides del plan del cliente. Si es mayor que imageUrls.length, los
                                         // slots sobrantes se rellenan con slides de texto puro (ver carrusel mixto).
      carouselTheme?: string;           // CAROUSEL only — tema elegido en el selector de publish-carrusel.tsx.
                                         // "auto" o ausente = comportamiento de siempre (ver CarouselComposerAgent.run).
      saasId?: string;
      provider?: string;
      startDate?: string;
      batchIndex?: number;      // 0-based upload order — drives opener rotation only
      scheduleIndex?: number;   // 0-based position after content-type interleaving — drives day-pool assignment; falls back to batchIndex
      mode?: "analyze" | "finalize"; // "analyze" = LLaVA classification only (no caption/schedule); default ("finalize") runs the full pipeline
      imageAnalysis?: ImageAnalysis; // result of a prior "analyze" call — reused here to skip a duplicate LLaVA call
      forcedContentType?: "FEED" | "REEL" | "STORY" | "CAROUSEL"; // explicit format chosen in Publicar → Post/Reel/Historia/Carrusel; overrides the LLaVA heuristic below
    } | null;

    const isCarousel = body?.forcedContentType === "CAROUSEL";

    if (!body?.saasId) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "imageUrl, imageKey and saasId are required" },
        { status: 400 },
      );
    }
    if (isCarousel) {
      const urls = body.imageUrls;
      const keys = body.imageKeys;
      const targetSlideCount = body.targetSlideCount;
      // Carrusel mixto: si se pide más slides de las que hay fotos, la IA rellena el
      // resto — el mínimo real de fotos baja a 1 (puede ser 0 fotos + slides IA en
      // teoría, pero el flujo "Subir imágenes" siempre trae al menos 1). Sin
      // targetSlideCount (o con targetSlideCount <= urls.length) el comportamiento es
      // IDÉNTICO al de siempre: mínimo CAROUSEL_MIN_ITEMS, 100% fotos.
      const willFillWithAi = typeof targetSlideCount === "number" && targetSlideCount > (urls?.length ?? 0);
      const minPhotos = willFillWithAi ? 1 : CAROUSEL_MIN_ITEMS;
      if (
        !Array.isArray(urls) || !Array.isArray(keys) || urls.length !== keys.length ||
        urls.length < minPhotos || urls.length > CAROUSEL_MAX_ITEMS ||
        (typeof targetSlideCount === "number" && (targetSlideCount < CAROUSEL_MIN_ITEMS || targetSlideCount > CAROUSEL_MAX_ITEMS))
      ) {
        return NextResponse.json(
          {
            code: "INVALID_CAROUSEL_BODY",
            message: `imageUrls and imageKeys must be equal-length arrays of ${minPhotos}-${CAROUSEL_MAX_ITEMS} items`,
          },
          { status: 400 },
        );
      }
    } else if (!body?.imageUrl || !body?.imageKey) {
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
      accountType: session.accountType,
    });

    if (profile.accountType === "empresa") {
      // Empresa accounts speak as the brand, never as a personal creator — third person always.
      profile.voiceInstruction = `Escribe en tercera persona hablando de "${profile.brandIdentity}" como marca/entidad. NUNCA uses "yo", "mi", "me" ni "mis". Ejemplos correctos: "${profile.brandIdentity} presenta...", "En ${profile.brandIdentity} encontrarás...", "Nuestro equipo...". Ejemplo incorrecto: "Te comparto...".`;
    } else if (!profile.voiceInstruction) {
      // The upload flow is always a creator posting their own photo — force first-person voice
      // regardless of what the profile heuristic derived. This is the safety net.
      profile.voiceInstruction = `Escribe en primera persona singular (yo). Habla directamente como si fueras ${profile.brandIdentity} dirigiéndote a tu audiencia. NUNCA uses "${profile.brandIdentity}" en tercera persona ni como si fuera una empresa. Ejemplo correcto: "Te comparto..." — Ejemplo incorrecto: "En ${profile.brandIdentity} compartimos..."`;
    }

    if (isCarousel) {
      const imageUrls = body.imageUrls!;
      const imageKeys = body.imageKeys!;
      const providedAnalyses = body.imageAnalyses ?? [];
      const bucket = env()?.SOCIAL_MEDIA_BUCKET;

      // allSettled, no all — si 2 de 6 fotos fallan queremos las DOS en la respuesta de
      // error, no solo la primera que se cruce. Ninguna foto se analiza dos veces si el
      // cliente ya la analizó ("analyze" pre-pass), mismo patrón que el flujo singular.
      const settled = await Promise.allSettled(
        imageUrls.map(async (_url, i) => {
          const preAnalyzed = providedAnalyses[i];
          if (preAnalyzed) return preAnalyzed;
          if (!bucket) throw new Error("STORAGE_NOT_CONFIGURED");
          const r2Object = await bucket.get(imageKeys[i]);
          if (!r2Object) throw new Error("IMAGE_NOT_FOUND");
          const imageBytes = Array.from(new Uint8Array(await r2Object.arrayBuffer()));
          return new ImageAnalysisAgent().run({
            imageBytes,
            profile,
            tenantId: session.tenantId,
            saasId: body.saasId,
          });
        }),
      );

      const failedSlides = settled
        .map((result, order) => ({ result, order }))
        .filter((s): s is { result: PromiseRejectedResult; order: number } => s.result.status === "rejected")
        .map(({ result, order }) => ({
          order,
          imageKey: imageKeys[order],
          message: result.reason instanceof Error ? result.reason.message : String(result.reason),
        }));

      if (failedSlides.length > 0) {
        return NextResponse.json(
          { code: "CAROUSEL_SLIDE_ANALYSIS_FAILED", message: "One or more carousel photos failed to analyze.", failedSlides },
          { status: 422 },
        );
      }

      const imageAnalyses = (settled as PromiseFulfilledResult<ImageAnalysis>[]).map((r) => r.value);

      // Categoría única para todo el carrusel, tomada del slide 0 (la portada) — no por slide.
      const openerCategory = pickOpenerCategory(imageAnalyses[0], imageAnalyses[0].context);

      const [trends, isTrial] = await Promise.all([
        new TrendAgent().run({ profile }),
        isActiveSocialFlowTrial(session.tenantId, session.role),
      ]);

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

      // Carrusel mixto: si targetSlideCount pide más slides de las fotos analizadas, se
      // extiende slideContexts con slots vacíos (specificContext: "") al final — esos
      // son los que CarouselComposerAgent rellena con texto puro (ver hasPhotoAt ahí).
      // Sin targetSlideCount (o <= imageUrls.length) esto es un no-op: mismo array de
      // siempre, 1 por foto.
      const totalSlideCount = Math.max(body.targetSlideCount ?? imageUrls.length, imageUrls.length);
      const slideContexts = Array.from({ length: totalSlideCount }, (_, i) =>
        i < imageAnalyses.length
          ? { order: i, specificContext: imageAnalyses[i].specificContext }
          : { order: i, specificContext: "" },
      );

      const composition = await new CarouselComposerAgent().run({
        profile,
        keywordEngine,
        trends,
        openerCategory,
        slideContexts,
        carouselTheme: body.carouselTheme,
      });

      const scheduledAt = await computeScheduledSlot({
        tenantId: session.tenantId,
        saasId: body.saasId,
        profile,
        trends,
        isTrial,
        representativeAnalysis: imageAnalyses[0],
        batchIndex: body.batchIndex,
        scheduleIndex: body.scheduleIndex,
        logLabel: "carousel",
      });

      // Cuántos carruseles ya tiene este tenant en el mes en curso — determina qué
      // variante de estilo le toca rotar (getStyleForCarousel, resuelto en el cliente
      // para no acoplar CarouselStylePacks.ts, que es Canvas/cliente, a esta ruta server).
      const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: body.saasId });
      const existingPosts = await listSaasSocialPosts(ctx);
      const now = new Date();
      const carouselIndex = existingPosts.filter((p) => {
        if (p.contentType !== "CAROUSEL") return false;
        const created = new Date(p.createdAt);
        return created.getUTCFullYear() === now.getUTCFullYear() && created.getUTCMonth() === now.getUTCMonth();
      }).length;

      return NextResponse.json({
        imageAnalyses,
        niche: profile.niche,
        channelHandle: profile.channelHandle,
        carouselIndex,
        suggestedCarouselPost: {
          title: composition.slides[0]?.text.slice(0, 72) ?? imageAnalyses[0].context,
          hashtags: composition.hashtags,
          provider: body.provider ?? "INSTAGRAM",
          contentType: "CAROUSEL",
          scheduledAt,
          saasId: body.saasId,
          // imageUrl aquí es la foto ORIGINAL subida — sin texto quemado todavía, eso lo
          // hace StaticSlideRenderer en el cliente (siguiente pieza). undefined en los
          // slots que rellena la IA. Se resuelve por `photoIndex` (no por posición en el
          // array): en carrusel mixto CarouselComposerAgent intercala foto/texto-IA, así
          // que el índice del slide ya no coincide con el índice de subida de la foto —
          // el cliente le pasa `style` en vez de `imageUrl` a StaticSlideRenderer cuando
          // photoIndex es undefined.
          slides: composition.slides.map((slide) => ({
            order: slide.order,
            imageUrl: slide.photoIndex !== undefined ? imageUrls[slide.photoIndex] : undefined,
            text: slide.text,
            role: slide.role,
          })),
        },
      });
    }

    // Run LLaVA only when the caller hasn't already analyzed this image — the upload UI's
    // "analyze" pre-pass result is passed back here on the "finalize" call to avoid a
    // second, redundant vision-model call for the same photo.
    let imageAnalysis: ImageAnalysis;
    if (body.imageAnalysis) {
      imageAnalysis = body.imageAnalysis;
    } else {
      // Read image bytes directly from R2 binding (avoids public URL fetch)
      const bucket = env()?.SOCIAL_MEDIA_BUCKET;
      if (!bucket) {
        return NextResponse.json(
          { code: "STORAGE_NOT_CONFIGURED", message: "Media storage is not configured" },
          { status: 503 },
        );
      }
      // Non-null: la validación de arriba (rama !isCarousel) ya garantiza body.imageKey
      // en runtime, pero TS no compone la narrowing a través de dos ifs separados.
      const r2Object = await bucket.get(body.imageKey!);
      if (!r2Object) {
        return NextResponse.json(
          { code: "IMAGE_NOT_FOUND", message: "Image not found in storage" },
          { status: 404 },
        );
      }
      const imageBytes = Array.from(new Uint8Array(await r2Object.arrayBuffer()));
      imageAnalysis = await new ImageAnalysisAgent().run({
        imageBytes,
        profile,
        tenantId: session.tenantId,
        saasId: body.saasId,
      });
    }
    console.log(
      `${imageAnalysis.degraded ? "[ImageAnalysis DEGRADED]" : "[ImageAnalysis]"} description="${imageAnalysis.description}" context="${imageAnalysis.context}" themes=${JSON.stringify(imageAnalysis.suggestedThemes)}`,
    );

    // "analyze" mode: classification only. Used by the upload UI to learn every photo's
    // content type (foto_real vs. grafico_texto) in a batch before deciding the calendar
    // order — no caption/schedule work needed for this call.
    if (body.mode === "analyze") {
      return NextResponse.json({
        imageAnalysis,
        contentCategory: isGraphicTextContent(imageAnalysis) ? "grafico_texto" : "foto_real",
      });
    }

    // Step 1b: trends (Mistral) + trial check in parallel (image already analyzed above)
    const [trends, isTrial] = await Promise.all([
      new TrendAgent().run({ profile }),
      isActiveSocialFlowTrial(session.tenantId, session.role),
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
      employeeDetected: imageAnalysis.employeeDetected,
      tenantId: session.tenantId,
      saasId: body.saasId,
    });
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

    // Step 7: schedule slot — factorizado en computeScheduledSlot (misma lógica exacta,
    // ver la función definida arriba, cerca de pickHourFromContent).
    const computedScheduledAt = await computeScheduledSlot({
      tenantId: session.tenantId,
      saasId: body.saasId,
      profile,
      trends,
      isTrial,
      representativeAnalysis: imageAnalysis,
      batchIndex: body.batchIndex,
      scheduleIndex: body.scheduleIndex,
      logLabel: "singular",
    });

    const provider = body.provider ?? "INSTAGRAM";
    const contentTypeMap: Record<string, "FEED" | "REEL" | "STORY"> = {
      REEL: "REEL",
      STORY: "STORY",
      FEED: "FEED",
    };
    const contentType = body.forcedContentType ?? contentTypeMap[variant.recommendedPostType] ?? "FEED";
    const title = optimized.improvedText.split("\n")[0]?.replace(/^#+\s*/, "").slice(0, 72).trim()
      ?? strategyItem.theme;

    // Score viral — calculado ANTES de devolver el post al cliente para aprobar.
    // Nunca debe romper este endpoint: calculateViralScore ya degrada internamente
    // a un score neutro en cualquier fallo, y este try/catch es defensa adicional
    // en el punto de integración para que el flujo de aprobación jamás dependa de
    // que la puntuación exista.
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
        console.error("[generate-from-image] calculateViralScore failed", err instanceof Error ? err.message : String(err));
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
        viralScore,
        degraded: imageAnalysis.degraded ?? false,
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
    if (error instanceof CarouselGenerationFailedError) {
      return NextResponse.json(
        { code: error.code, message: "No se pudo generar el contenido. Inténtalo de nuevo." },
        { status: 503 },
      );
    }
    console.error("SOCIALFLOW_GENERATE_FROM_IMAGE_ERROR", error);
    return NextResponse.json(
      { code: "SOCIALFLOW_ERROR", message: "Unable to generate post from image" },
      { status: 500 },
    );
  }
}
