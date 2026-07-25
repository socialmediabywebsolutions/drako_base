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
): string {
  if (role === "intro") {
    return OPENERS_BY_CATEGORY[openerCategory]?.[0] ?? `Esto es lo que necesitas saber sobre ${profile.niche}.`;
  }
  if (role === "cierre_cta") {
    return resolveObjectiveCta(profile) || profile.primaryCTA || "Guarda este post y cuéntanos qué opinas en los comentarios.";
  }
  return specificContext || `Un detalle importante sobre ${profile.niche}.`;
}

export class CarouselComposerAgent {
  async run(input: {
    profile: BrandProfile;
    keywordEngine: KeywordEngineOutput;
    trends: TrendInsights;
    openerCategory: OpenerCategory;
    // Una entrada por foto, en el mismo orden en que el cliente las subió — viene de
    // N llamadas paralelas a ImageAnalysisAgent (Opción A ya acordada).
    slideContexts: { order: number; specificContext: string }[];
  }): Promise<CarouselComposition> {
    const { profile, keywordEngine, openerCategory, slideContexts } = input;
    const isEmpresa = profile.accountType === "empresa";
    const total = slideContexts.length;
    const objectiveCta = resolveObjectiveCta(profile);

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
        const text = fallbackSlideText(role, profile, openerCategory, s.specificContext);
        return { order: s.order, role, text: clampSlideText(text, role) };
      }),
      hashtags: uniqueHashtags,
      tone: profile.toneOfVoice,
    };

    const slideContextLines = slideContexts
      .map((s, i) => `Slide ${i + 1} (${roleForIndex(i, total)}): "${s.specificContext}"`)
      .join("\n");

    const cierreCtaInstruction = objectiveCta
      ? `- Último slide (cierre_cta): este slide YA tiene su call-to-action fijo ("${objectiveCta}") — no lo reescribas, el JSON base que recibirás ya lo trae listo para ese slide.`
      : `- Último slide (cierre_cta): cierre + llamada a la acción (${profile.primaryCTA || "invita a comentar o guardar el post"}). MÁXIMO ${CAROUSEL_SLIDE_TEXT_LIMITS.cierre_cta} caracteres.`;

    const prompt = `Escribe el texto de un carrusel educativo de Instagram sobre "${profile.niche}" para la marca "${profile.brandIdentity}", con exactamente ${total} slides, EN ESPAÑOL.

${isEmpresa
  ? `⚠️ VOZ — REGLA IRROMPIBLE: Escribe SIEMPRE en tercera persona hablando de "${profile.brandIdentity}" como marca/entidad. NUNCA uses "yo", "mi", "me" ni "mis".`
  : `⚠️ VOZ — REGLA IRROMPIBLE: Escribe SIEMPRE en primera persona singular (yo, mi, me, mis). Nunca hables de "${profile.brandIdentity}" en tercera persona.`}
${profile.voiceInstruction ? `${profile.voiceInstruction}\n` : ""}
Categoría del carrusel: "${openerCategory}" — todo el carrusel debe sonar coherente con este ángulo (ej. si es "receta", las ${total} tarjetas narran una receta paso a paso; si es "tecnica", una técnica de ejecución).

Cada slide corresponde a una foto ya analizada. Ancla el texto de CADA slide en su propio detalle visual — NUNCA inventes un dato que no esté en el detalle:
${slideContextLines}

Estructura narrativa obligatoria:
- Slide 1 (intro): gancho corto que abra el tema. MÁXIMO ${CAROUSEL_SLIDE_TEXT_LIMITS.intro} caracteres.
- Slides intermedios (desarrollo, si los hay): un punto educativo concreto por slide, anclado en su propio detalle visual. MÁXIMO ${CAROUSEL_SLIDE_TEXT_LIMITS.desarrollo} caracteres cada uno.
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
