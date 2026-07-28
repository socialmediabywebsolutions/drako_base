import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile, KeywordEngineOutput, SocialFlowClientObjective } from "../types";
import type { TrendInsights } from "./TrendAgent";
import { OPENERS_BY_CATEGORY, type OpenerCategory } from "../openers/pickOpenerCategory";

// Composición multi-slide para carruseles de Instagram — una sola llamada a Mistral
// que recibe el specificContext de cada foto (ya analizada por N llamadas paralelas a
// ImageAnalysisAgent, sin tocar esa clase) y devuelve el arco narrativo completo
// (intro → desarrollo → cierre/CTA) en un solo JSON, en vez de repetir el par
// ContentGeneratorAgent+OptimizationAgent una vez por slide.

// Posición narrativa del slide dentro del carrusel — distinto del ReelsTextRole
// (title/subtitle/cta) que ya existe en CanvasRenderer.ts para la jerarquía visual
// DENTRO de un frame; StaticSlideRenderer mapea uno al otro (ver auditoría).
export type CarouselSlideRole = "intro" | "desarrollo" | "cierre_cta";

// Presupuesto de caracteres por rol para que el texto quepa en el overlay estático
// sin desbordar el canvas — wrapText no trunca, solo envuelve en más líneas, así que
// sin este límite un texto largo del rol "intro" (fuente 120px) se saldría del frame.
// Estimado a partir del ancho disponible (canvasWidth*0.85) y ancho medio de carácter
// en fuente bold system-ui — no son mediciones de producción, son cálculo de wrap.
export const CAROUSEL_SLIDE_TEXT_LIMITS: Record<CarouselSlideRole, number> = {
  intro: 70,
  desarrollo: 110,
  cierre_cta: 130,
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

// CTA fijo por objetivo del cliente (BrandProfile.clientObjective, configurado una vez en
// el perfil) — se usa tal cual para el slide cierre_cta, sin pedirle a la IA que lo
// redacte. Son frases ya decididas, no una sugerencia de estilo: mismo motivo por el que
// se protegió "cta" de la sobrescritura de la IA en el motor de Reels (ver
// mergeAiStructuredOutput/protectedKeys) — si se le pide "también" que lo escriba, tiende
// a generar uno propio y el objetivo configurado deja de reflejarse en el resultado.
const CTA_BY_OBJECTIVE: Record<SocialFlowClientObjective, string> = {
  followers: "Sígueme para más contenido como este 👉 {handle}",
  engagement: "¿Cuál vas a aplicar hoy? Cuéntame 👇",
  leads: "Escríbeme por DM y te explico cómo empezar 💬",
  sales: "Link en bio para conseguirlo 🛒",
  saves: "Guarda esto para cuando lo necesites 🔖",
};

function resolveObjectiveCta(profile: BrandProfile): string | null {
  if (!profile.clientObjective) return null;
  return CTA_BY_OBJECTIVE[profile.clientObjective].replace("{handle}", profile.channelHandle || "");
}

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
    return resolveObjectiveCta(profile) || profile.primaryCTA || "Guarda este post y cuéntanos qué opinas en los comentarios.";
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
// vacío; ni el prompt ni fallbackSlideText anclan nada en detalle visual cuando
// hasPhotos es false, ver su uso en run()).
function resolveSlidePlan(input: {
  slideContexts?: { order: number; specificContext: string }[];
  slideCount?: number;
}): { slideContexts: { order: number; specificContext: string }[]; hasPhotos: boolean } {
  if (input.slideContexts && input.slideContexts.length > 0) {
    return { slideContexts: input.slideContexts, hasPhotos: true };
  }
  const total = clampSlideCount(input.slideCount ?? DEFAULT_TOPIC_SLIDE_COUNT);
  return {
    slideContexts: Array.from({ length: total }, (_, i) => ({ order: i, specificContext: "" })),
    hasPhotos: false,
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
    const { slideContexts, hasPhotos } = resolveSlidePlan(input);
    const total = slideContexts.length;
    const objectiveCta = resolveObjectiveCta(profile);
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

    // Solo tiene sentido en modo foto — en modo "Crear con IA" no hay detalle visual
    // que listar (specificContext viene vacío para todos los slides, ver
    // resolveSlidePlan); listarlas igual solo metería ruido vacío en el prompt.
    const slideContextLines = hasPhotos
      ? slideContexts.map((s, i) => `Slide ${i + 1} (${roleForIndex(i, total)}): "${s.specificContext}"`).join("\n")
      : "";

    const cierreCtaInstruction = objectiveCta
      ? `- Último slide (cierre_cta): este slide YA tiene su call-to-action fijo ("${objectiveCta}") — no lo reescribas, el JSON base que recibirás ya lo trae listo para ese slide.`
      : `- Último slide (cierre_cta): cierre + llamada a la acción (${profile.primaryCTA || "invita a comentar o guardar el post"}). MÁXIMO ${CAROUSEL_SLIDE_TEXT_LIMITS.cierre_cta} caracteres.`;

    // Único bloque que difiere de verdad entre los dos modos: con fotos, el texto de
    // cada slide se ancla en su detalle visual real (nunca inventar un dato que no esté
    // ahí); sin fotos (Fase 7), no hay nada que anclar — el ancla pasa a ser el tema
    // declarado, y ahí el modelo SÍ tiene que aportar el contenido educativo (no hay
    // "detalle" del que tirar).
    const contentAnchorInstruction = hasPhotos
      ? `Cada slide corresponde a una foto ya analizada. Ancla el texto de CADA slide en su propio detalle visual — NUNCA inventes un dato que no esté en el detalle:\n${slideContextLines}`
      : `No hay fotos — este carrusel es 100% generado. Desarrolla el tema "${resolvedTopic}" con un punto educativo concreto y distinto por slide (nunca repitas la misma idea en dos slides, nunca dejes un slide vacío de contenido real).`;

    const prompt = `Escribe el texto de un carrusel educativo de Instagram sobre "${profile.niche}" para la marca "${profile.brandIdentity}", con exactamente ${total} slides, EN ESPAÑOL.

${isEmpresa
  ? `⚠️ VOZ — REGLA IRROMPIBLE: Escribe SIEMPRE en tercera persona hablando de "${profile.brandIdentity}" como marca/entidad. NUNCA uses "yo", "mi", "me" ni "mis".`
  : `⚠️ VOZ — REGLA IRROMPIBLE: Escribe SIEMPRE en primera persona singular (yo, mi, me, mis). Nunca hables de "${profile.brandIdentity}" en tercera persona.`}
${profile.voiceInstruction ? `${profile.voiceInstruction}\n` : ""}
Categoría del carrusel: "${openerCategory}" — todo el carrusel debe sonar coherente con este ángulo (ej. si es "receta", las ${total} tarjetas narran una receta paso a paso; si es "tecnica", una técnica de ejecución).

${contentAnchorInstruction}

Estructura narrativa obligatoria:
- Slide 1 (intro): gancho corto que abra el tema. MÁXIMO ${CAROUSEL_SLIDE_TEXT_LIMITS.intro} caracteres.
- Slides intermedios (desarrollo, si los hay): un punto educativo concreto por slide${hasPhotos ? ", anclado en su propio detalle visual" : ` sobre "${resolvedTopic}"`}. MÁXIMO ${CAROUSEL_SLIDE_TEXT_LIMITS.desarrollo} caracteres cada uno.
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
