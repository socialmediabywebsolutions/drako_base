import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile, KeywordEngineOutput } from "../types";
import type { TrendInsights } from "./TrendAgent";
import { OPENERS_BY_CATEGORY, type OpenerCategory } from "../openers/pickOpenerCategory";
import { resolveObjectiveCta } from "../utils/ctaUtils";

// Composición multi-slide para carruseles de Instagram — una sola llamada a Mistral
// que recibe el specificContext de cada foto (ya analizada por N llamadas paralelas a
// ImageAnalysisAgent, sin tocar esa clase) y devuelve el arco narrativo completo
// (intro → desarrollo → cierre/CTA) en un solo JSON, en vez de repetir el par
// ContentGeneratorAgent+OptimizationAgent una vez por slide.

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
  order: number;            // 0-based, mismo orden que las fotos subidas
  role: CarouselSlideRole;
  text: string;             // clamped a CAROUSEL_SLIDE_TEXT_LIMITS[role] antes de devolverse
};

export type CarouselComposition = {
  id: string;
  openerCategory: OpenerCategory;  // una sola categoría para todo el carrusel
  slides: CarouselSlideText[];     // length === N fotos, mismo orden
  hashtags: string[];              // 10-15, misma convención que OptimizedPost.hashtags
  tone: string;
};

// Posición narrativa por índice — determinista, nunca se le pide a Mistral que la
// etiquete. Con 2 slides (plan Starter) no hay "desarrollo": el primero es intro,
// el segundo (que también es el último) es cierre_cta.
function roleForIndex(index: number, total: number): CarouselSlideRole {
  if (index === 0) return "intro";
  if (index === total - 1) return "cierre_cta";
  return "desarrollo";
}

// Recorte por palabra completa (sin "...", a diferencia de truncateCaption en
// publishing.ts) — este texto se dibuja sobre una foto, no continúa en ningún lado,
// así que un "..." colgando se vería fuera de lugar en la tarjeta.
function clampSlideText(text: string, role: CarouselSlideRole): string {
  const limit = CAROUSEL_SLIDE_TEXT_LIMITS[role];
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  const cut = trimmed.lastIndexOf(" ", limit - 1);
  return (cut > 0 ? trimmed.slice(0, cut) : trimmed.slice(0, limit)).trim();
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
// poblado desde N fotos analizadas, se usa tal cual), "Crear con IA" (Fase 7,
// slideContexts ausente/vacío — se generan `slideCount` slides con specificContext
// vacío) o carrusel MIXTO (el caller ya intercaló specificContext real con "" para
// los slots que rellena la IA — ver route.ts generate-from-image). `hasPhotoAt` es
// por-posición (no un único booleano global) precisamente para soportar el modo
// mixto: cada slide sabe si debe anclarse en detalle visual real o no.
function resolveSlidePlan(input: {
  slideContexts?: { order: number; specificContext: string }[];
  slideCount?: number;
}): { slideContexts: { order: number; specificContext: string }[]; hasPhotoAt: boolean[] } {
  if (input.slideContexts && input.slideContexts.length > 0) {
    return {
      slideContexts: input.slideContexts,
      hasPhotoAt: input.slideContexts.map((s) => s.specificContext.trim().length > 0),
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
  }): Promise<CarouselComposition> {
    const { profile, keywordEngine, openerCategory } = input;
    const isEmpresa = profile.accountType === "empresa";
    const { slideContexts, hasPhotoAt } = resolveSlidePlan(input);
    const total = slideContexts.length;
    const objectiveCta = resolveObjectiveCta(profile.clientObjective, profile.channelHandle);
    // Nicho + KB (profile.contentPillars ya viene del KB del cliente, igual que en el
    // resto de agentes) + tema explícito si lo trajo el cliente — mismo criterio de
    // prioridad que usa el resto del pipeline para decidir "de dónde sale el ángulo".
    const resolvedTopic = input.topic?.trim() || profile.contentPillars[0] || profile.niche;

    const hashtagPool = [
      ...(profile.baseHashtags ?? []),
      ...(profile.priorityHashtags ?? []),
      ...(keywordEngine.campaignHashtags ?? []),
    ];
    const uniqueHashtags = Array.from(new Set(hashtagPool)).slice(0, 15);

    const base: CarouselComposition = {
      id: `carousel_${Date.now()}`,
      openerCategory,
      slides: slideContexts.map((s, i) => {
        const role = roleForIndex(i, total);
        const text = fallbackSlideText(role, profile, openerCategory, s.specificContext, resolvedTopic);
        return { order: s.order, role, text: clampSlideText(text, role) };
      }),
      hashtags: uniqueHashtags,
      tone: profile.toneOfVoice,
    };

    // hasPhotoAt es por-posición (no un único booleano global) para soportar el
    // carrusel MIXTO: algunos slides traen detalle visual real (fotos del cliente),
    // otros no (slots que rellena la IA, ver route.ts generate-from-image). Cada línea
    // lleva su propia instrucción según corresponda, en vez de un bloque homogéneo.
    const hasAnyPhoto = hasPhotoAt.some(Boolean);
    const hasAnyAiSlide = hasPhotoAt.some((v) => !v);
    const slideContextLines = slideContexts
      .map((s, i) => {
        const role = roleForIndex(i, total);
        return hasPhotoAt[i]
          ? `Slide ${i + 1} (${role}): ancla el texto en su propio detalle visual — NUNCA inventes un dato que no esté aquí: "${s.specificContext}"`
          : `Slide ${i + 1} (${role}): sin foto — desarrolla el tema "${resolvedTopic}" con un punto educativo concreto, sin inventar ningún detalle visual.`;
      })
      .join("\n");

    const cierreCtaInstruction = objectiveCta
      ? `- Último slide (cierre_cta): este slide YA tiene su call-to-action fijo ("${objectiveCta}") — no lo reescribas, el JSON base que recibirás ya lo trae listo para ese slide.`
      : `- Último slide (cierre_cta): cierre + llamada a la acción (${profile.primaryCTA || "invita a comentar o guardar el post"}). MÁXIMO ${CAROUSEL_SLIDE_TEXT_LIMITS.cierre_cta} caracteres.`;

    // Con fotos (todas o algunas), el texto de cada slide con foto se ancla en su
    // detalle visual real (nunca inventar un dato que no esté ahí); sin fotos (Fase 7)
    // o en los slots IA de un carrusel mixto, el ancla pasa a ser el tema declarado, y
    // ahí el modelo SÍ tiene que aportar el contenido educativo (no hay "detalle" del
    // que tirar). En modo mixto se listan las dos instrucciones por slide explícitamente
    // para que el modelo no generalice el criterio de un slide al resto.
    const contentAnchorInstruction = !hasAnyPhoto
      ? `No hay fotos — este carrusel es 100% generado. Desarrolla el tema "${resolvedTopic}" con un punto educativo concreto y distinto por slide (nunca repitas la misma idea en dos slides, nunca dejes un slide vacío de contenido real).`
      : hasAnyAiSlide
        ? `Este carrusel MEZCLA slides con foto real y slides sin foto (rellenados por IA). Sigue la instrucción de CADA slide tal como se detalla abajo — nunca inventes un detalle visual en un slide sin foto, y nunca ignores el detalle real en un slide que sí lo tiene:\n${slideContextLines}`
        : `Cada slide corresponde a una foto ya analizada. Ancla el texto de CADA slide en su propio detalle visual — NUNCA inventes un dato que no esté en el detalle:\n${slideContextLines}`;

    const prompt = `Escribe el texto de un carrusel educativo de Instagram sobre "${profile.niche}" para la marca "${profile.brandIdentity}", con exactamente ${total} slides, EN ESPAÑOL.

${isEmpresa
  ? `⚠️ VOZ — REGLA IRROMPIBLE: Escribe SIEMPRE en tercera persona hablando de "${profile.brandIdentity}" como marca/entidad. NUNCA uses "yo", "mi", "me" ni "mis".`
  : `⚠️ VOZ — REGLA IRROMPIBLE: Escribe SIEMPRE en primera persona singular (yo, mi, me, mis). Nunca hables de "${profile.brandIdentity}" en tercera persona.`}
${profile.voiceInstruction ? `${profile.voiceInstruction}\n` : ""}
Categoría del carrusel: "${openerCategory}" — todo el carrusel debe sonar coherente con este ángulo (ej. si es "receta", las ${total} tarjetas narran una receta paso a paso; si es "tecnica", una técnica de ejecución).

${contentAnchorInstruction}

Estructura narrativa obligatoria:
- Slide 1 (intro): gancho corto que abra el tema. MÁXIMO ${CAROUSEL_SLIDE_TEXT_LIMITS.intro} caracteres.
- Slides intermedios (desarrollo, si los hay): un punto educativo concreto por slide${hasAnyPhoto ? ", anclado en su propio detalle visual cuando el slide tenga foto (ver instrucción de cada slide arriba)" : ` sobre "${resolvedTopic}"`}. MÁXIMO ${CAROUSEL_SLIDE_TEXT_LIMITS.desarrollo} caracteres cada uno.
${cierreCtaInstruction}

Genera también entre 10 y 15 hashtags relevantes para el carrusel completo.
Responde SOLO con el JSON solicitado, con exactamente ${total} slides en el mismo orden en que se listaron arriba.`;

    const { data } = await defaultLocalModel.generateStructured<CarouselComposition>({ prompt }, () => base);

    // Nunca confiar en el modelo para el rol (es determinista por posición) ni para la
    // longitud (es un presupuesto visual, no una preferencia de estilo) — se reasignan
    // aquí sin importar lo que Mistral haya devuelto, igual que OptimizationAgent ya
    // fuerza el conteo de hashtags en código en vez de confiar solo en el prompt. Si el
    // modelo devuelve menos/más slides de los pedidos, o un slide vacío, cada posición
    // cae de vuelta al fallback determinista de su rol — nunca queda un slide sin texto.
    data.slides = slideContexts.map((s, i) => {
      const role = roleForIndex(i, total);
      if (role === "cierre_cta" && objectiveCta) {
        return { order: s.order, role, text: clampSlideText(objectiveCta, role) };
      }
      const modelText = typeof data.slides[i]?.text === "string" ? data.slides[i].text.trim() : "";
      const text = modelText.length > 0 ? modelText : base.slides[i].text;
      return { order: s.order, role, text: clampSlideText(text, role) };
    });

    if (Array.isArray(data.hashtags) && data.hashtags.length > 15) {
      data.hashtags = data.hashtags.slice(0, 15);
    }
    if (Array.isArray(data.hashtags) && data.hashtags.length < 10) {
      const needed = 10 - data.hashtags.length;
      data.hashtags = [...data.hashtags, ...uniqueHashtags.slice(0, needed)];
    }

    return data;
  }
}
