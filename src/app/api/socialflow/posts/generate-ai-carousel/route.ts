export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { SocialContextError, resolveSocialContext, getFutureScheduledSlots, listSaasSocialPosts } from "@/lib/socialflow/repository";
import { SocialFlowOrchestrator } from "@/lib/socialflow/ai/SocialFlowOrchestrator";
import type { ImageAnalysis } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";
import { TrendAgent, type TrendInsights } from "@/lib/socialflow/ai/agents/TrendAgent";
import { CarouselComposerAgent, CarouselGenerationFailedError } from "@/lib/socialflow/ai/agents/CarouselComposerAgent";
import { pickOpenerCategory, isGraphicTextContent } from "@/lib/socialflow/ai/openers/pickOpenerCategory";
import { getStyleForCarousel, getNichoPackKey, CAROUSEL_STYLE_PACKS } from "@/lib/socialflow/carousel/CarouselStylePacks";
import type { BrandProfile, KeywordEngineOutput } from "@/lib/socialflow/ai/types";
import { isActiveSocialFlowTrial } from "@/lib/socialflow/billing/enforce";
import { calculateViralScore, type ViralScore } from "@/lib/socialflow/intelligence/ViralScoreAgent";
import { env } from "@/lib/cf";

// Hermano de posts/generate-from-image/route.ts para el modo "Crear con IA" (Fase 7,
// carrusel sin fotos) — compone el texto de cada slide y resuelve el estilo visual, pero
// NUNCA renderiza PNGs ni sube nada a R2: StaticSlideRenderer necesita OffscreenCanvas/
// document, que solo existen en el navegador (ver CanvasRenderer.ts/StaticSlideRenderer.ts
// — mismo motivo por el que ReelsCreator renderiza en el cliente), no en el runtime de
// Cloudflare Workers donde corre esta ruta. El render + subida a R2 vive en el componente
// cliente que consuma esta respuesta — mismo reparto de trabajo que ya usa
// publish-carrusel.tsx con el modo "Subir imágenes": el server compone texto y resuelve
// estilo, el cliente renderiza y sube.

function unauthorizedResponse() {
  return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
}

// Duplicado literal de normalizeAnalysisText/pickHourFromContent/computeScheduledSlot en
// posts/generate-from-image/route.ts — esa ruta no las exporta y esta fase no debe tocar
// ningún otro archivo todavía, así que se copian tal cual (mismo algoritmo de
// passes/rollover de mes) para que el scheduling de este endpoint se comporte idéntico al
// del hermano. Recortado: sin el parámetro `logLabel`/console.log de diagnóstico ni el
// fallback a `batchIndex` (este endpoint no tiene concepto de orden de subida). Candidato
// a extraer a un módulo compartido si las dos copias empiezan a divergir en mantenimiento.
function normalizeAnalysisText(analysis: ImageAnalysis): string {
  const raw = [analysis.description, analysis.context].join(" ");
  return raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function pickHourFromContent(analysis: ImageAnalysis): number | null {
  const text = normalizeAnalysisText(analysis);
  if (/ensalada|receta|cocin|\bplato\b|\bcomer\b|ingredi|bebida|batido|\bjugo\b/.test(text)) return 12;
  if (/dormir|\bcama\b|meditaci|\byoga\b|respirar|\bnoche\b|\bsueno\b/.test(text)) return 21;
  if (isGraphicTextContent(analysis)) return 18;
  return null;
}

async function computeScheduledSlot(input: {
  tenantId: string;
  saasId: string;
  profile: BrandProfile;
  trends: TrendInsights;
  isTrial: boolean;
  representativeAnalysis: ImageAnalysis;
  scheduleIndex?: number;
}): Promise<string> {
  const { tenantId, saasId, profile, trends, isTrial, representativeAnalysis } = input;
  const todayUtc = new Date().toISOString().slice(0, 10);

  const socialCtx = await resolveSocialContext({ tenantId, saasId });
  const futureSlots = await getFutureScheduledSlots(socialCtx).catch(() => [] as string[]);

  const FITNESS_RE = /fitness|lifestyle|wellness|salud|health|gym|sport|yoga|pilates|nutrici|coach|entrenami|ejercici/i;
  const nicheHours = FITNESS_RE.test(profile.niche) ? [7, 12, 18] : [9, 18];
  const aiHours = (trends.optimalHours ?? []).filter((h) => Number.isInteger(h) && h >= 0 && h < 24).slice(0, 3);
  const resolvedHours = aiHours.length >= 2 ? aiHours : nicheHours;

  const MAX_POSTS_PER_DAY = isTrial ? 1 : 3;

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

  const MAX_MONTHS_AHEAD = 24;
  let windowDays: string[] = [];
  let occupiedHoursPerDay = new Map<string, Set<number>>();
  let dayPool: string[] = [];

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

    let monthPass = MAX_POSTS_PER_DAY;
    for (let p = 0; p < MAX_POSTS_PER_DAY; p++) {
      if (monthDays.some((day) => (monthOccupied.get(day)?.size ?? 0) === p)) {
        monthPass = p + 1;
        break;
      }
    }

    const monthDayPool = monthDays.filter((day) => (monthOccupied.get(day)?.size ?? 0) === monthPass - 1);

    windowDays = monthDays;
    occupiedHoursPerDay = monthOccupied;
    dayPool = monthDayPool;

    if (monthDayPool.length > 0) break;
  }

  const scheduleIndex = typeof input.scheduleIndex === "number" && input.scheduleIndex >= 0 ? input.scheduleIndex : 0;
  const targetDate = dayPool.length > 0 ? dayPool[scheduleIndex % dayPool.length] : windowDays[0];

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

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string;
      theme?: string;
      slideCount?: number;
      provider?: string;
    } | null;

    if (!body?.saasId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId is required" }, { status: 400 });
    }

    // tenantId SIEMPRE sale de la sesión, nunca del body — un tenantId de cliente sería
    // la misma clase de bug de aislamiento entre tenants que ya se corrigió una vez en
    // el registro de SocialFlow. Mismo criterio que el resto de esta API.
    const session = await requireCurrentSocialFlowSession(request);

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

    const [trends, isTrial] = await Promise.all([
      new TrendAgent().run({ profile }),
      isActiveSocialFlowTrial(session.tenantId, session.role),
    ]);

    // Sin foto que clasificar — el tema (explícito del cliente, o el primer pilar del
    // KB, o el nicho a secas) hace las veces de "descripción/contexto" para que
    // pickOpenerCategory/pickHourFromContent apliquen la misma batería de keywords que
    // ya usan sobre un ImageAnalysis real.
    const resolvedTopic = body.theme?.trim() || profile.contentPillars[0] || profile.niche;
    const syntheticAnalysis: ImageAnalysis = {
      description: resolvedTopic,
      emotion: "",
      context: resolvedTopic,
      recommendedPostType: "FEED",
      suggestedThemes: profile.contentPillars,
      specificContext: "",
      momentType: "estatico_compuesto",
      employeeDetected: null,
    };
    const openerCategory = pickOpenerCategory(syntheticAnalysis, resolvedTopic);

    const keywordEngine: KeywordEngineOutput = {
      clusters: profile.contentPillars.slice(0, 3).map((pillar, i) => ({
        cluster: pillar,
        intent: (["awareness", "consideration", "conversion"] as const)[i % 3],
        difficulty: "medium" as const,
        trendScore: 70,
        seasonality: null,
        contentAngles: profile.contentPillars,
        keywords: profile.baseKeywords.slice(0, 3),
        hashtags: profile.baseHashtags.slice(0, 5),
      })),
      evergreenHashtags: profile.baseHashtags,
      trendingHashtags: trends.trendingTopics
        .map((t) => `#${t.replace(/\s+/g, "").replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9]/g, "").toLowerCase()}`)
        .filter((h) => h.length > 2)
        .slice(0, 10),
      nicheHashtags: profile.competitorHashtags.slice(0, 5),
      viralHashtags: profile.viralThemes.map((t) => `#${t.replace(/\s+/g, "").toLowerCase()}`),
      campaignHashtags: profile.priorityHashtags,
    };

    const composition = await new CarouselComposerAgent().run({
      profile,
      keywordEngine,
      trends,
      openerCategory,
      topic: resolvedTopic,
      slideCount: body.slideCount,
      tenantId: session.tenantId,
      saasId: body.saasId,
    });

    // Mismo patrón defensivo que generate-from-image/route.ts (rama carrusel):
    // calculateViralScore ya degrada internamente a un score neutro en cualquier fallo,
    // este try/catch es defensa adicional para que la generación nunca dependa de que
    // la puntuación exista.
    let viralScore: ViralScore | null = null;
    const dracoEnvForCarouselScore = env();
    if (dracoEnvForCarouselScore) {
      try {
        viralScore = await calculateViralScore({
          caption: composition.caption,
          hashtags: composition.hashtags,
          format: "CARRUSEL",
          niche: profile.niche,
          tenantId: session.tenantId,
          saasId: body.saasId,
          env: dracoEnvForCarouselScore,
        });
      } catch (err) {
        console.error("[generate-ai-carousel] calculateViralScore failed", err instanceof Error ? err.message : String(err));
        viralScore = null;
      }
    }

    const scheduledAt = await computeScheduledSlot({
      tenantId: session.tenantId,
      saasId: body.saasId,
      profile,
      trends,
      isTrial,
      representativeAnalysis: syntheticAnalysis,
    });

    // Cuántos carruseles ya tiene este tenant en el mes en curso — determina qué
    // variante de estilo le toca rotar (mismo criterio que la rama CAROUSEL de
    // generate-from-image/route.ts).
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: body.saasId });
    const existingPosts = await listSaasSocialPosts(ctx);
    const now = new Date();
    const carouselIndex = existingPosts.filter((p) => {
      if (p.contentType !== "CAROUSEL") return false;
      const created = new Date(p.createdAt);
      return created.getUTCFullYear() === now.getUTCFullYear() && created.getUTCMonth() === now.getUTCMonth();
    }).length;

    // CarouselStylePacks.ts es datos puros (sin Canvas/document) — a diferencia de
    // StaticSlideRenderer, sí puede resolverse aquí en el servidor. Se devuelve ya
    // resuelto para que el cliente no tenga que repetir esta llamada.
    const resolvedStyle = getStyleForCarousel(profile.niche, carouselIndex);
    const packKey = getNichoPackKey(profile.niche);

    return NextResponse.json({
      niche: profile.niche,
      channelHandle: profile.channelHandle,
      carouselIndex,
      style: resolvedStyle,
      styleLabel: `${CAROUSEL_STYLE_PACKS[packKey].label} · ${resolvedStyle.label}`,
      suggestedCarouselPost: {
        title: composition.slides[0]?.text.slice(0, 72) ?? resolvedTopic,
        hashtags: composition.hashtags,
        provider: body.provider ?? "INSTAGRAM",
        contentType: "CAROUSEL",
        scheduledAt,
        saasId: body.saasId,
        viralScore,
        // Sin imageUrl — no hay foto origen (modo "Crear con IA"). El cliente renderiza
        // cada slide con StaticSlideRenderer usando `style` (fondo generado) y sube el
        // PNG resultante a R2, mismo patrón que ya usa publish-carrusel.tsx para fotos.
        slides: composition.slides.map((slide) => ({ order: slide.order, text: slide.text, role: slide.role })),
      },
    });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
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
    console.error("SOCIALFLOW_GENERATE_AI_CAROUSEL_ERROR", error);
    return NextResponse.json(
      { code: "SOCIALFLOW_ERROR", message: "Unable to generate AI carousel" },
      { status: 500 },
    );
  }
}
