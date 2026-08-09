import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile, KeywordEngineOutput } from "../types";
import type { TrendInsights } from "./TrendAgent";
import { OPENERS_BY_CATEGORY, type OpenerCategory } from "../openers/pickOpenerCategory";
import { resolveObjectiveCta } from "../utils/ctaUtils";
import { getNicheIntelligence, getStyleHistory } from "@/lib/socialflow/intelligence/NicheIntelligenceService";
import { extractEngagementPatterns } from "@/lib/socialflow/intelligence/CrossTenantIntelligenceAgent";
import { extractTrendSignals } from "@/lib/socialflow/intelligence/TrendKeywordAgent";
import { extractVoiceSection } from "../utils/voiceUtils";
import { env } from "@/lib/cf";

// Shape of StyleLearningAgent's result, as stored (JSON.stringify'd) in each
// StyleSnapshot.snapshotJson row — duplicated here as a minimal local type
// instead of importing StyleLearningAgent, same reasoning as
// NicheIntelligenceService's own safeParseObject: this agent only needs to
// read three fields, not depend on the class that produced them.
function parseLatestStyleSnapshot(snapshotJson: string): { avgCaptionLength: number; topHookPatterns: string[]; bestPerformingHours: number[] } | null {
  try {
    const parsed = JSON.parse(snapshotJson);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      avgCaptionLength: typeof parsed.avgCaptionLength === "number" ? parsed.avgCaptionLength : 0,
      topHookPatterns: Array.isArray(parsed.topHookPatterns) ? parsed.topHookPatterns.filter((p: unknown) => typeof p === "string") : [],
      bestPerformingHours: Array.isArray(parsed.bestPerformingHours) ? parsed.bestPerformingHours.filter((h: unknown) => typeof h === "number") : [],
    };
  } catch {
    return null;
  }
}

// Composición multi-slide para carruseles de Instagram — una sola llamada a Mistral
// que recibe el specificContext de cada foto (ya analizada por N llamadas paralelas a
// ImageAnalysisAgent, sin tocar esa clase) y devuelve el arco narrativo completo
// (intro → desarrollo → cierre/CTA) en un solo JSON, en vez de repetir el par
// ContentGeneratorAgent+OptimizationAgent una vez por slide.

// Lanzada cuando defaultLocalModel.generateStructured() no pudo llamar a Mistral y
// devolvió el seed determinista (isFallback: true) — antes de este fix, ese contenido de
// plantilla (openers con placeholders sin resolver, specificContext crudo, "Un punto
// clave sobre X") se devolvía como si fuera una composición real (ver auditoría). Los
// callers (route.ts) la traducen a HTTP 503 en vez de un 200 con contenido de plantilla.
export class CarouselGenerationFailedError extends Error {
  code = "CAROUSEL_AI_GENERATION_FAILED";
  constructor() {
    super("No se pudo generar el contenido del carrusel con IA.");
    this.name = "CarouselGenerationFailedError";
  }
}

// Posición narrativa del slide dentro del carrusel — distinto del ReelsTextRole
// (title/subtitle/cta) que ya existe en CanvasRenderer.ts para la jerarquía visual
// DENTRO de un frame; StaticSlideRenderer mapea uno al otro (ver auditoría).
export type CarouselSlideRole = "intro" | "desarrollo" | "cierre_cta";

// Presupuesto de caracteres por rol para que el texto quepa en el overlay estático sin
// desbordar el canvas — wrapText no trunca, solo envuelve en más líneas. StaticSlideRenderer
// ahora tiene un auto-shrink de fuente como red de seguridad (ver MAX_TEXT_BLOCK_HEIGHT_RATIO
// en StaticSlideRenderer.ts), pero estos límites siguen siendo la primera línea de defensa
// para que el texto no llegue ya demasiado largo a esa red.
export const CAROUSEL_SLIDE_TEXT_LIMITS: Record<CarouselSlideRole, number> = {
  intro: 70,
  desarrollo: 90,
  cierre_cta: 100,
};

export type CarouselSlideText = {
  order: number;            // 0-based, posición final del slide en el carrusel (puede intercalar fotos y texto IA — ver resolveSlidePlan)
  role: CarouselSlideRole;
  text: string;             // clamped a CAROUSEL_SLIDE_TEXT_LIMITS[role] antes de devolverse
  photoIndex?: number;      // índice en el array de fotos subidas (imageUrls) — undefined si el slide es texto puro IA. En carrusel mixto el orden final ya no es 1:1 con el orden de subida.
};

// Presupuesto de caracteres para el caption de Instagram (independiente del texto de
// los slides) — límite generoso de Instagram, no un requisito de diseño como
// CAROUSEL_SLIDE_TEXT_LIMITS; aquí es solo un tope razonable para el campo de
// descripción, no un espacio visual que desborde un canvas.
export const CAROUSEL_CAPTION_MAX_LENGTH = 2200;

export function clampCaption(text: string): string {
  const trimmed = text.trim();
  return trimmed.length <= CAROUSEL_CAPTION_MAX_LENGTH ? trimmed : trimmed.slice(0, CAROUSEL_CAPTION_MAX_LENGTH).trim();
}

// El default de defaultLocalModel (4096, ver localModel.ts) quedó justo tras el
// Cambio 2 (caption de hasta CAROUSEL_CAPTION_MAX_LENGTH chars + secciones de Cerebro
// en el prompt) — un carrusel de hasta 10 slides con caption largo puede acercarse a
// ese techo y cortar la respuesta de Mistral a mitad de un string (ver auditoría
// "slides cortados" 2026-08-07: el bug del cierre_cta a 43/100 chars no lo explicaba
// clampSlideText, la única causa que sobrevivió fue esta). Solo este agente lo eleva —
// el resto de agentes sigue en 4096 sin cambios.
const CAROUSEL_MAX_TOKENS = 8192;

export type CarouselComposition = {
  id: string;
  openerCategory: OpenerCategory;  // una sola categoría para todo el carrusel
  slides: CarouselSlideText[];     // length === total slides; orden final del carrusel (puede intercalar fotos y texto IA en modo mixto)
  hashtags: string[];              // 10-15, misma convención que OptimizedPost.hashtags
  tone: string;
  // Descripción de Instagram, independiente del texto visual de los slides (que antes
  // se usaba, concatenado, como caption — ver auditoría Sprint A sección 5). Hook +
  // desarrollo narrativo + CTA, máx CAROUSEL_CAPTION_MAX_LENGTH caracteres.
  caption: string;
};

// Posición narrativa por índice — determinista, nunca se le pide a Mistral que la
// etiquete. Con 2 slides (plan Starter) no hay "desarrollo": el primero es intro,
// el segundo (que también es el último) es cierre_cta.
function roleForIndex(index: number, total: number): CarouselSlideRole {
  if (index === 0) return "intro";
  if (index === total - 1) return "cierre_cta";
  return "desarrollo";
}

const SENTENCE_END = /[.!?]/;
// Si el último signo de puntuación dentro del límite retiene menos de este % del
// presupuesto de caracteres, se descarta ese corte (perdería demasiado contenido —
// ej. una frase corta seguida de una frase larga cortada) y se usa el fallback de
// palabra completa + "..." en su lugar. Ver auditoría "slides cortados" 2026-08-07.
const MIN_PUNCTUATION_RETENTION_RATIO = 0.6;

// Corta en el último signo de puntuación completo (. ! ?) dentro del límite, para no
// dejar la frase a mitad de pensamiento (bug real: el corte anterior, por palabra
// suelta y sin "...", producía slides como "...para el" o "...en los"). Si no hay
// puntuación utilizable (retendría menos de MIN_PUNCTUATION_RETENTION_RATIO del
// presupuesto), cae al recorte por palabra completa + "..." — a diferencia de
// truncateCaption en publishing.ts, este texto se dibuja sobre una foto, así que el
// "..." solo aparece cuando es la única opción razonable.
export function clampSlideText(text: string, role: CarouselSlideRole): string {
  const limit = CAROUSEL_SLIDE_TEXT_LIMITS[role];
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;

  const window = trimmed.slice(0, limit);
  let lastPunct = -1;
  for (let i = window.length - 1; i >= 0; i--) {
    if (SENTENCE_END.test(window[i])) {
      lastPunct = i;
      break;
    }
  }
  if (lastPunct >= 0 && lastPunct + 1 >= limit * MIN_PUNCTUATION_RETENTION_RATIO) {
    return window.slice(0, lastPunct + 1).trim();
  }

  const ellipsisBudget = limit - 3;
  const cut = trimmed.lastIndexOf(" ", ellipsisBudget - 1);
  const base = cut > 0 ? trimmed.slice(0, cut) : trimmed.slice(0, Math.max(0, ellipsisBudget));
  return `${base.trim()}...`;
}

function fallbackSlideText(
  role: CarouselSlideRole,
  profile: BrandProfile,
  openerCategory: OpenerCategory,
  specificContext: string,
  topic?: string,
): string {
  if (role === "intro") {
    return OPENERS_BY_CATEGORY[openerCategory]?.[0] ?? `Esto es lo que necesitas saber sobre ${profile.niche}.`;
  }
  if (role === "cierre_cta") {
    return (
      resolveObjectiveCta(profile.clientObjective, profile.channelHandle) ||
      profile.primaryCTA ||
      "Guarda este post y cuéntanos qué opinas en los comentarios."
    );
  }
  // specificContext viene vacío en modo "Crear con IA" (ver resolveSlidePlan) — ahí el
  // fallback se apoya en el tema declarado en vez del detalle visual de una foto que no existe.
  return specificContext || (topic ? `Un punto clave sobre ${topic}.` : `Un detalle importante sobre ${profile.niche}.`);
}

// Fase 7 — modo "Crear con IA" (sin fotos): cuántos slides generar cuando no hay
// slideContexts real. Acotado al mismo rango que ya permite cualquier carrusel
// (CAROUSEL_MIN_ITEMS/CAROUSEL_MAX_ITEMS en meta/publishing.ts) — duplicado aquí como
// límite numérico simple para no acoplar este agente a ese módulo.
const DEFAULT_TOPIC_SLIDE_COUNT = 5;
const MIN_TOPIC_SLIDE_COUNT = 2;
const MAX_TOPIC_SLIDE_COUNT = 10;

function clampSlideCount(count: number): number {
  return Math.min(MAX_TOPIC_SLIDE_COUNT, Math.max(MIN_TOPIC_SLIDE_COUNT, Math.round(count)));
}

// Resuelve el plan de slides según el modo: "Subir imágenes" (slideContexts ya viene
// poblado desde N fotos analizadas, se usa tal cual) o "Crear con IA" (Fase 7,
// slideContexts ausente/vacío — se generan `slideCount` slides con specificContext
// vacío). En carrusel MIXTO (el caller manda fotos + slots vacíos que rellena la IA —
// ver route.ts generate-from-image) el orden de entrada trae todas las fotos primero;
// aquí se intercalan foto/texto-IA (foto, texto relacionado, foto, texto relacionado...)
// para que el carrusel no se sienta "fotos y luego bloque de texto". Los sobrantes (si
// #fotos != #slots IA) se agrupan al final, antes del último slide (que siempre es
// cierre_cta por posición, sin importar si terminó siendo foto o texto). `photoIndex`
// rastrea a qué foto original (índice en imageUrls) corresponde cada slide con foto,
// porque tras intercalar el índice del array ya no coincide con el de subida.
// `hasPhotoAt` es por-posición (no un único booleano global) precisamente para soportar
// el modo mixto: cada slide sabe si debe anclarse en detalle visual real o no.
function resolveSlidePlan(input: {
  slideContexts?: { order: number; specificContext: string }[];
  slideCount?: number;
}): { slideContexts: { order: number; specificContext: string; photoIndex?: number }[]; hasPhotoAt: boolean[] } {
  if (input.slideContexts && input.slideContexts.length > 0) {
    const photos = input.slideContexts
      .map((s, i) => ({ specificContext: s.specificContext, photoIndex: i }))
      .filter((s) => s.specificContext.trim().length > 0);
    const aiSlots = input.slideContexts.filter((s) => s.specificContext.trim().length === 0);

    let ordered: { specificContext: string; photoIndex?: number }[];
    if (photos.length === 0 || aiSlots.length === 0) {
      // Sin mezcla real (todo foto o todo texto IA) — no hay nada que intercalar.
      ordered = input.slideContexts.map((s, i) => ({
        specificContext: s.specificContext,
        photoIndex: s.specificContext.trim().length > 0 ? i : undefined,
      }));
    } else {
      const pairCount = Math.min(photos.length, aiSlots.length);
      ordered = [];
      for (let i = 0; i < pairCount; i++) {
        ordered.push(photos[i]);
        ordered.push({ specificContext: aiSlots[i].specificContext });
      }
      ordered.push(...photos.slice(pairCount));
      ordered.push(...aiSlots.slice(pairCount).map((s) => ({ specificContext: s.specificContext })));
    }

    return {
      slideContexts: ordered.map((s, i) => ({ order: i, specificContext: s.specificContext, photoIndex: s.photoIndex })),
      hasPhotoAt: ordered.map((s) => s.specificContext.trim().length > 0),
    };
  }
  const total = clampSlideCount(input.slideCount ?? DEFAULT_TOPIC_SLIDE_COUNT);
  return {
    slideContexts: Array.from({ length: total }, (_, i) => ({ order: i, specificContext: "" })),
    hasPhotoAt: Array.from({ length: total }, () => false),
  };
}

export class CarouselComposerAgent {
  async run(input: {
    profile: BrandProfile;
    keywordEngine: KeywordEngineOutput;
    trends: TrendInsights;
    openerCategory: OpenerCategory;
    // Modo "Subir imágenes": una entrada por foto, en el mismo orden en que el cliente
    // las subió — viene de N llamadas paralelas a ImageAnalysisAgent (Opción A ya
    // acordada). Modo "Crear con IA" (Fase 7): se omite o se pasa vacío — ver
    // topic/slideCount y resolveSlidePlan.
    slideContexts?: { order: number; specificContext: string }[];
    // SOLO modo "Crear con IA" (slideContexts vacío/ausente) — tema elegido por el
    // cliente, o decidido aguas arriba según KB+nicho. Se ignora si slideContexts trae
    // datos (ahí el ancla es el detalle visual de cada foto, no un tema declarado).
    topic?: string;
    // SOLO modo "Crear con IA" — cuántos slides generar (2-10, default 5). Se ignora
    // si slideContexts trae datos (ahí total = slideContexts.length, como siempre).
    slideCount?: number;
    // Tema elegido por el cliente en el selector de publish-carrusel.tsx (modo "Subir
    // imágenes" — orthogonal a `topic`, que es solo del modo "Crear con IA"). "auto" o
    // ausente = comportamiento de siempre (la IA infiere el ángulo de las fotos/KB). Con
    // un valor explícito, ese tema manda TANTO en la instrucción top-of-prompt como en
    // `resolvedTopic` (usado por los slides sin foto) — evita que ambos queden
    // desalineados.
    carouselTheme?: string;
    // Opcional — habilita el contexto "Cerebro Socialcors" (audiencia/dolor, extracto
    // de KB, keywords, tendencias del nicho y estilo aprendido) en el prompt. Ausente
    // en algún caller degrada de forma elegante al comportamiento de siempre, sin
    // añadir ninguna sección — mismo patrón que ContentGeneratorAgent.
    tenantId?: string;
    saasId?: string;
  }): Promise<CarouselComposition> {
    const { profile, keywordEngine, openerCategory } = input;
    const isEmpresa = profile.accountType === "empresa";
    const { slideContexts, hasPhotoAt } = resolveSlidePlan(input);
    const total = slideContexts.length;
    const objectiveCta = resolveObjectiveCta(profile.clientObjective, profile.channelHandle);
    const explicitTheme = input.carouselTheme?.trim();
    const hasExplicitTheme = !!explicitTheme && explicitTheme.toLowerCase() !== "auto";
    // Nicho + KB (profile.contentPillars ya viene del KB del cliente, igual que en el
    // resto de agentes) + tema explícito si lo trajo el cliente — mismo criterio de
    // prioridad que usa el resto del pipeline para decidir "de dónde sale el ángulo".
    // El tema del selector (carouselTheme) tiene prioridad sobre `topic` (modo "Crear
    // con IA") porque ambos nunca llegan a la vez desde el mismo caller.
    const resolvedTopic = hasExplicitTheme
      ? explicitTheme!
      : input.topic?.trim() || profile.contentPillars[0] || profile.niche;

    // Cerebro Socialcors — mismo patrón que ContentGeneratorAgent (ver
    // ContentGeneratorAgent.ts): degrada de forma elegante a "sin sección" cuando no
    // hay binding de env o no hay tenantId/saasId (callers que aún no los pasan).
    // Hoisted antes de hashtagPool (Sprint F) — los hashtags reales necesitan estar
    // disponibles para dar prioridad sobre profile.baseHashtags en el pool.
    const dracoEnv = env();
    const [nicheIntel, styleHistory] = dracoEnv
      ? await Promise.all([
          getNicheIntelligence(profile.niche, dracoEnv, input.tenantId, input.saasId),
          input.tenantId && input.saasId
            ? getStyleHistory(input.tenantId, input.saasId, dracoEnv)
            : Promise.resolve([]),
        ])
      : [null, []];

    // Real, cross-tenant hashtag data (Sprint F) — read directly from
    // analysis.engagementPatterns, ver ContentGeneratorAgent.ts para la misma lógica.
    const realHashtagValues = (extractEngagementPatterns(nicheIntel?.analysis)?.hashtagsQueFuncionanRealmente ?? [])
      .slice(0, 8)
      .map((h) => h.hashtag);

    const hashtagPool = [
      // Reales primero — el pool se deduplica y trunca a 15 más abajo, así que los
      // hashtags con tracción real ganan cualquier hueco frente a los manuales del perfil.
      ...realHashtagValues,
      ...(profile.baseHashtags ?? []),
      ...(profile.priorityHashtags ?? []),
      ...(keywordEngine.campaignHashtags ?? []),
    ];
    const uniqueHashtags = Array.from(new Set(hashtagPool)).slice(0, 15);

    const fallbackSlides = slideContexts.map((s, i) => {
      const role = roleForIndex(i, total);
      const text = fallbackSlideText(role, profile, openerCategory, s.specificContext, resolvedTopic);
      return { order: s.order, role, text: clampSlideText(text, role), photoIndex: s.photoIndex };
    });

    const base: CarouselComposition = {
      id: `carousel_${Date.now()}`,
      openerCategory,
      slides: fallbackSlides,
      hashtags: uniqueHashtags,
      tone: profile.toneOfVoice,
      // Mismo criterio que el frontend usaba antes de este cambio (concatenar los
      // textos de los slides) — solo como red de seguridad si Mistral no devuelve
      // un caption utilizable, nunca el resultado esperado en el camino feliz.
      caption: clampCaption(fallbackSlides.map((s) => s.text).join("\n\n")),
    };

    // hasPhotoAt es por-posición (no un único booleano global) para soportar el
    // carrusel MIXTO: algunos slides traen detalle visual real (fotos del cliente),
    // otros no (slots que rellena la IA, ya intercalados con las fotos — ver
    // resolveSlidePlan). Cada línea lleva su propia instrucción según corresponda, en
    // vez de un bloque homogéneo. Para slides con foto la instrucción pide un mensaje de
    // VALOR inspirado en la imagen, no una descripción literal de lo que se ve (causa
    // raíz detectada en auditoría: el modelo describía la foto en vez de aportar valor).
    // Para un slide de texto IA que quedó justo después de una foto (por el intercalado),
    // se le pide explícitamente que amplíe/complemente esa foto en vez de partir de cero.
    const hasAnyPhoto = hasPhotoAt.some(Boolean);
    const hasAnyAiSlide = hasPhotoAt.some((v) => !v);
    const slideContextLines = slideContexts
      .map((s, i) => {
        const role = roleForIndex(i, total);
        if (hasPhotoAt[i]) {
          return `Slide ${i + 1} (${role}): la foto muestra: "${s.specificContext}". Inspírate en lo que transmite esta imagen para crear un mensaje de VALOR REAL para la audiencia — no describas la foto, sino qué aprende, qué siente o qué puede hacer el lector gracias a este momento. Si la imagen muestra comida, da un tip nutricional o una receta rápida. Si muestra ejercicio, da un tip de técnica o motivación específica. Si muestra un lugar, cuenta algo interesante de ese lugar. Nunca digas "en esta foto veo" ni describas lo que aparece visualmente.`;
        }
        const precedingPhotoContext = i > 0 && hasPhotoAt[i - 1] ? slideContexts[i - 1].specificContext : null;
        return precedingPhotoContext
          ? `Slide ${i + 1} (${role}, texto IA, relacionada con la foto anterior de "${precedingPhotoContext}"): desarrolla un mensaje de valor que amplíe o complemente lo que transmite esa foto, sin describirla literalmente ni repetir el mismo ángulo del slide anterior.`
          : `Slide ${i + 1} (${role}): sin foto — desarrolla el tema "${resolvedTopic}" con un punto educativo concreto, sin inventar ningún detalle visual.`;
      })
      .join("\n");

    const cierreCtaInstruction = objectiveCta
      ? `- Último slide (cierre_cta): este slide YA tiene su call-to-action fijo ("${objectiveCta}") — no lo reescribas, el JSON base que recibirás ya lo trae listo para ese slide.`
      : `- Último slide (cierre_cta): cierre + llamada a la acción (${profile.primaryCTA || "invita a comentar o guardar el post"}). MÁXIMO ${CAROUSEL_SLIDE_TEXT_LIMITS.cierre_cta} caracteres.`;

    // Con fotos (todas o algunas), el texto de cada slide con foto se inspira en su
    // detalle visual real para generar un mensaje de VALOR (nunca una descripción
    // literal ni un dato inventado); sin fotos (Fase 7) o en los slots IA de un carrusel
    // mixto, el ancla pasa a ser el tema declarado (o la foto inmediatamente anterior,
    // si el intercalado la dejó ahí), y ahí el modelo SÍ tiene que aportar el contenido
    // educativo (no hay "detalle" del que tirar). En modo mixto se listan las dos
    // instrucciones por slide explícitamente para que el modelo no generalice el
    // criterio de un slide al resto.
    const contentAnchorInstruction = !hasAnyPhoto
      ? `No hay fotos — este carrusel es 100% generado. Desarrolla el tema "${resolvedTopic}" con un punto educativo concreto y distinto por slide (nunca repitas la misma idea en dos slides, nunca dejes un slide vacío de contenido real).`
      : hasAnyAiSlide
        ? `Este carrusel MEZCLA slides con foto real y slides sin foto (rellenados por IA). Sigue la instrucción de CADA slide tal como se detalla abajo — para las slides con foto, crea un mensaje de valor inspirado en la imagen (nunca la describas literalmente); para las slides sin foto, nunca inventes un detalle visual:\n${slideContextLines}`
        : `Cada slide corresponde a una foto ya analizada. Para CADA slide, crea un mensaje de VALOR inspirado en su detalle visual — nunca te limites a describir la foto:\n${slideContextLines}`;

    // Instrucción de tema explícito (selector del cliente) — va ANTES que VOZ/categoría
    // para que el modelo la lea como restricción de más alto nivel, no como un detalle
    // más entre otros. Vacía (sin línea) cuando el tema es "auto": comportamiento de
    // siempre, la IA infiere el ángulo de las fotos/KB.
    const themeInstruction = hasExplicitTheme
      ? `Este carrusel es sobre "${explicitTheme}". TODO el contenido debe girar en torno a este tema específico. El tema debe reforzarse en CADA slide, no solo mencionarse al inicio.\n\n`
      : "";

    const audienceSection = `\nAUDIENCIA Y DOLOR:\n- Quién es: ${profile.audience}\n- Buyer persona: ${profile.buyerPersona}\n- Qué le duele: ${profile.painPoints.join(", ")}\n- Qué desea: ${profile.desires.join(", ")}\n`;

    // profile.longDescription ya trae la KB embebida por buildProfile() (ver
    // auditoría) — el resto del pipeline (ContentGeneratorAgent) lee longDescription
    // completo vía richProfileLines(); aquí se extrae solo el bloque de KB para no
    // duplicar la descripción base de marca, que ya está implícita en el resto del
    // prompt (brandIdentity, niche, etc).
    const kbMarker = "--- Knowledge Base ---";
    const kbIndex = profile.longDescription.indexOf(kbMarker);
    const kbExtract = kbIndex >= 0 ? profile.longDescription.slice(kbIndex + kbMarker.length).trim().slice(0, 600) : "";
    const kbSection = kbExtract ? `\nCONOCIMIENTO DEL CLIENTE:\n${kbExtract}\n` : "";

    // Extraída explícitamente en vez de depender de que quepa dentro del truncado de
    // 600 caracteres de kbExtract — la sección de estilo (auto_learned_style) va primero
    // en el bloque de KB y por sí sola puede ocupar los 600 caracteres enteros, dejando
    // la voz real fuera casi siempre. Mismo patrón que OptimizationAgent/ReelsAgent.
    const voiceSection = extractVoiceSection(profile.longDescription);
    const voiceSectionBlock = voiceSection ? `\nVOZ REAL DEL CLIENTE:\n${voiceSection}\n` : "";

    const keywordPool = Array.from(new Set([...(profile.priorityKeywords ?? []), ...(profile.baseKeywords ?? [])])).filter(Boolean).slice(0, 8);
    const keywordsSection = keywordPool.length ? `\nKEYWORDS A INCLUIR NATURALMENTE EN EL CAPTION:\n${keywordPool.join(", ")}\n` : "";

    // Sprint G (TrendKeywordAgent) — mismo criterio que ContentGeneratorAgent.ts: señales
    // crudas de Reddit/Google Trends que hasta ahora solo se guardaban en
    // analysis_json.trendSignals sin llegar nunca al prompt.
    const trendSignals = extractTrendSignals(nicheIntel?.analysis);

    const nicheIntelSection = nicheIntel
      ? `\nINTELIGENCIA DEL NICHO ESTA SEMANA:\n${nicheIntel.hooks.length ? `- Hooks que funcionan: ${nicheIntel.hooks.join(" | ")}\n` : ""}${nicheIntel.formats.length ? `- Formatos ganadores: ${nicheIntel.formats.join(", ")}\n` : ""}${nicheIntel.hashtags.length ? `- Hashtags de tendencia: ${nicheIntel.hashtags.join(" ")}\n` : ""}${realHashtagValues.length ? `- Hashtags con tracción real en tu nicho esta semana: ${realHashtagValues.join(" ")} — prioriza estos.\n` : ""}${trendSignals?.redditTopics.length ? `- Temas trending en comunidades (Reddit): ${trendSignals.redditTopics.slice(0, 5).join(" | ")}\n` : ""}${trendSignals?.globalTrends.length ? `- Tendencias globales esta semana: ${trendSignals.globalTrends.slice(0, 5).join(", ")}\n` : ""}`
      : "";

    const latestStyle = styleHistory[0] ? parseLatestStyleSnapshot(styleHistory[0].snapshotJson) : null;
    const styleSection = latestStyle
      ? `\nESTILO APRENDIDO DEL CLIENTE:\n- Longitud media de caption: ${latestStyle.avgCaptionLength} caracteres.\n${latestStyle.topHookPatterns.length ? `- Patrones de hook más usados: ${latestStyle.topHookPatterns.join(", ")}.\n` : ""}${latestStyle.bestPerformingHours.length ? `- Mejores horas (UTC): ${latestStyle.bestPerformingHours.join(", ")}.\n` : ""}`
      : "";

    const prompt = `Escribe el texto de un carrusel educativo de Instagram sobre "${profile.niche}" para la marca "${profile.brandIdentity}", con exactamente ${total} slides, EN ESPAÑOL.

${themeInstruction}${isEmpresa
  ? `⚠️ VOZ — REGLA IRROMPIBLE: Escribe SIEMPRE en tercera persona hablando de "${profile.brandIdentity}" como marca/entidad. NUNCA uses "yo", "mi", "me" ni "mis".`
  : `⚠️ VOZ — REGLA IRROMPIBLE: Escribe SIEMPRE en primera persona singular (yo, mi, me, mis). Nunca hables de "${profile.brandIdentity}" en tercera persona.`}
${profile.voiceInstruction ? `${profile.voiceInstruction}\n` : ""}
${audienceSection}${kbSection}${voiceSectionBlock}${keywordsSection}${nicheIntelSection}${styleSection}
Categoría del carrusel: "${openerCategory}" — todo el carrusel debe sonar coherente con este ángulo (ej. si es "receta", las ${total} tarjetas narran una receta paso a paso; si es "tecnica", una técnica de ejecución).

${contentAnchorInstruction}

Estructura narrativa obligatoria:
- Slide 1 (intro): gancho corto que abra el tema. MÁXIMO ${CAROUSEL_SLIDE_TEXT_LIMITS.intro} caracteres.
- Slides intermedios (desarrollo, si los hay): un punto educativo concreto por slide${hasAnyPhoto ? ", anclado en su propio detalle visual cuando el slide tenga foto (ver instrucción de cada slide arriba)" : ` sobre "${resolvedTopic}"`}. MÁXIMO ${CAROUSEL_SLIDE_TEXT_LIMITS.desarrollo} caracteres cada uno.
${cierreCtaInstruction}

Genera también entre 10 y 15 hashtags relevantes para el carrusel completo.

Además, escribe un campo "caption" — la descripción de Instagram, INDEPENDIENTE del texto de los slides (nunca repitas literalmente lo que ya dice cada tarjeta):
- Primera línea: un hook fuerte y autocontenido, MÁXIMO 125 caracteres (es lo único visible antes de que Instagram corte con "ver más").
- Después del hook: un desarrollo narrativo que complemente el contenido de los slides con contexto adicional, no un resumen de ellos.
${keywordPool.length ? `- Integra de forma natural estas keywords si encajan: ${keywordPool.join(", ")}.\n` : ""}- Cierra con una pregunta como CTA que invite a comentar.
- Longitud total MÁXIMA: ${CAROUSEL_CAPTION_MAX_LENGTH} caracteres.

Responde SOLO con el JSON solicitado, con exactamente ${total} slides en el mismo orden en que se listaron arriba, y el campo "caption" descrito arriba.`;

    const { data, isFallback } = await defaultLocalModel.generateStructured<CarouselComposition>(
      { prompt, maxTokens: CAROUSEL_MAX_TOKENS },
      () => base,
    );
    // Mejor fallar con un 503 explícito que devolver contenido de plantilla que el
    // cliente podría aprobar sin darse cuenta (ver auditoría: openers con placeholders,
    // specificContext crudo, "Un punto clave sobre X" — todos síntomas de este mismo
    // fallback silencioso).
    if (isFallback) {
      throw new CarouselGenerationFailedError();
    }

    // Nunca confiar en el modelo para el rol (es determinista por posición) ni para la
    // longitud (es un presupuesto visual, no una preferencia de estilo) — se reasignan
    // aquí sin importar lo que Mistral haya devuelto, igual que OptimizationAgent ya
    // fuerza el conteo de hashtags en código en vez de confiar solo en el prompt. Si el
    // modelo devuelve menos/más slides de los pedidos, o un slide vacío, cada posición
    // cae de vuelta al fallback determinista de su rol — nunca queda un slide sin texto.
    data.slides = slideContexts.map((s, i) => {
      const role = roleForIndex(i, total);
      if (role === "cierre_cta" && objectiveCta) {
        return { order: s.order, role, text: clampSlideText(objectiveCta, role), photoIndex: s.photoIndex };
      }
      const modelText = typeof data.slides[i]?.text === "string" ? data.slides[i].text.trim() : "";
      const text = modelText.length > 0 ? modelText : base.slides[i].text;
      return { order: s.order, role, text: clampSlideText(text, role), photoIndex: s.photoIndex };
    });

    if (Array.isArray(data.hashtags) && data.hashtags.length > 15) {
      data.hashtags = data.hashtags.slice(0, 15);
    }
    if (Array.isArray(data.hashtags) && data.hashtags.length < 10) {
      const needed = 10 - data.hashtags.length;
      data.hashtags = [...data.hashtags, ...uniqueHashtags.slice(0, needed)];
    }

    // Mismo criterio que ya se aplica a slides/hashtags: nunca confiar ciegamente en
    // que el modelo devolvió el campo — si falta o viene vacío, cae al fallback
    // determinista en vez de dejar el carrusel sin descripción de Instagram.
    data.caption = typeof data.caption === "string" && data.caption.trim() ? clampCaption(data.caption) : base.caption;

    return data;
  }
}
