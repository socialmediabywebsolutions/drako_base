import type { ImageAnalysis } from "../agents/ImageAnalysisAgent";

// Single source of truth for opener categories + their opening lines + the classifier
// that picks a category from an ImageAnalysis. Previously pickOpenerCategory() was
// duplicated verbatim in posts/generate-from-image/route.ts and
// campaigns/[id]/photos/route.ts, and OPENERS_BY_CATEGORY lived inline in
// ContentGeneratorAgent.ts. All three now import from here.

export type OpenerCategory =
  | "gym"
  | "cocina"
  | "receta"
  | "outdoor"
  | "lifestyle"
  | "tecnica"
  | "programa"
  | "mito"
  | "motivacional";

// Openers grouped by image category so the caption's first line actually matches
// what's in the photo, instead of one generic list shared by every kind of image.
export const OPENERS_BY_CATEGORY: Record<OpenerCategory, string[]> = {
  gym: [
    "Otra sesión terminada: [sensación o logro concreto de hoy].",
    "Esto me costó admitirlo: [verdad incómoda sobre entrenar].",
    "Hoy el cuerpo pedía parar. No paré. [resultado o lección].",
    "Lo que nadie te cuenta antes de tomarte en serio el entrenamiento:",
    "Años entrenando y por fin entendí: [lección clave].",
  ],
  cocina: [
    "Esta receta me salvó una semana entera de [problema real].",
    "Seré honesta: [verdad incómoda sobre comer bien].",
    "Lo que aprendí cocinando esto para mí misma:",
    "Años buscando esto y por fin lo encontré: [resultado].",
    "La verdad sobre [tema de nutrición o comida]:",
  ],
  outdoor: [
    "Salir hoy casi no pasaba. Me alegra que sí.",
    "Esto me recordó por qué hago esto: [sensación o logro].",
    "Lo que nadie te dice sobre moverte al aire libre:",
    "Cambié la rutina de siempre por esto, y funcionó.",
    "¿Alguna vez sentiste que necesitabas salir de la rutina?",
  ],
  lifestyle: [
    "¿Alguna vez has sentido que [situación relacionada con el tema]?",
    "Hoy necesito contarte algo sobre [tema].",
    "La verdad sobre [tema]:",
    "Esto me cambió la manera de ver [tema].",
    "Lo que nadie te cuenta sobre [tema]:",
  ],
  tecnica: [
    "Esto es lo que nadie me explicó sobre [movimiento] hasta que me lesioné:",
    "Llevo meses corrigiendo este error en [ejercicio]:",
    "La diferencia entre hacer esto bien o mal es esta:",
    "Nadie te dice esto sobre la técnica de [ejercicio]:",
    "Cambié esto en mi postura y todo mejoró:",
  ],
  programa: [
    "Día [X] de mi reto de [tema]:",
    "Semana [X], esto es lo que estoy trabajando:",
    "Voy por el día [X] y esto es lo que aprendí:",
    "Empecé este reto hace [X] días, aquí va la actualización:",
    "Esto es lo que cambia en tu cuerpo en la semana [X]:",
  ],
  mito: [
    "Llevo tiempo escuchando esto y no es verdad:",
    "Esto que crees sobre [tema] es un mito:",
    "Nadie cuestiona esto, pero debería:",
    "Todo el mundo repite esto y está mal:",
    "Esto que dicen sobre [tema] no tiene base real:",
  ],
  receta: [
    "Esta es la receta que más me piden:",
    "Llevo semanas preparando esto después de entrenar:",
    "Esto es lo que como cuando quiero algo rápido y saludable:",
    "Esta combinación me cambió la digestión post-entreno:",
    "Esto es lo que llevo en el tupper esta semana:",
  ],
  motivacional: [
    "Esto necesitaba leerlo yo también hoy:",
    "Si hoy te cuesta arrancar, esto es para ti:",
    "Guarda esto para el día que quieras rendirte:",
    "Esto me lo repito cuando no tengo ganas:",
    "Esto cambió cómo veo los días malos:",
  ],
};

function normalizeText(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Quote cards / typography-driven graphics vs. real photos (person, food, exercise,
// scenery). Single source of truth — previously duplicated in generate-from-image/route.ts
// and campaigns/[id]/photos/route.ts (each with its own GRAPHIC_TEXT_RE + function); both
// now import this instead. Used here to detect motivational quote-card images for opener
// classification, and by the route files for pickHourFromContent's schedule logic and the
// "analyze" mode's foto_real/grafico_texto classification.
export const GRAPHIC_TEXT_RE = /\bfrase|\bcita\b|\btexto\b|\bquote\b|letras|tipografi/;
export function isGraphicTextContent(analysis: ImageAnalysis): boolean {
  const text = normalizeText([analysis.description, analysis.context].join(" "));
  return GRAPHIC_TEXT_RE.test(text);
}

// Fallback mapping for callers that pass a StrategyAgent-style theme (e.g. "mitos vs
// realidad", "estrategia avanzada" — see StrategyAgent.ts). In the photo→post flow
// (generate-from-image, campaigns/[id]/photos) strategyItem.theme is currently just
// imageAnalysis.context (the same short visual-context phrase already checked above by
// the main keyword pass), so this fallback rarely changes the outcome there today — it
// exists for callers where theme genuinely carries a richer category, and returns null
// (no confident mapping) rather than guessing when the theme text doesn't match cleanly.
function mapThemeToCategory(theme: string): OpenerCategory | null {
  const text = normalizeText(theme);
  if (/mito/.test(text)) return "mito";
  if (/reto|desafio|programa|semana \d|dia \d/.test(text)) return "programa";
  if (/receta|ingredientes|preparacion/.test(text)) return "receta";
  if (/tecnica|postura|movilidad|estiramiento|ejecucion/.test(text)) return "tecnica";
  return null;
}

// Classify the photo (+ optional strategy theme) into an opener category so
// ContentGeneratorAgent picks a first line that actually matches what's in the image,
// instead of one generic opener list for everything.
//
// Priority order (first match wins):
//   1. motivacional — graphic/quote-card images are classified by visual signal alone,
//      before any text keyword check (a quote card's caption text is unreliable for
//      distinguishing it from other categories).
//   2. receta — specific recipe/ingredient/preparation language.
//   3. cocina — generic food/nutrition content without a specific recipe.
//   4. programa — challenge/program/day-N/week-N language, checked before "tecnica"/"gym"
//      since a caption that mentions "día 5 de mi reto... entrenamiento" is clearly
//      program content even though "entrenamiento" would also match the gym bucket.
//   5. tecnica — posture/technique/execution language (checked before "gym" for the same
//      specific-before-generic reason).
//   6. gym — general workout/equipment language.
//   7. outdoor — outdoor/running/nature language.
//   8. mito — myth-busting/"this isn't true" language. Checked last among the keyword
//      passes (not right after motivacional) because its keywords ("verdad", "realidad")
//      are common standalone words more likely to appear as filler in other categories'
//      text than a genuine myth-busting angle.
//   9. theme fallback — only if the caller passed a theme and it maps confidently.
//   10. lifestyle — final default, unchanged from the original behavior.
export function pickOpenerCategory(analysis: ImageAnalysis, theme?: string): OpenerCategory {
  if (isGraphicTextContent(analysis)) return "motivacional";

  const raw = [analysis.description, analysis.context, ...analysis.suggestedThemes].join(" ");
  const text = normalizeText(raw);

  if (/receta|ingredientes|preparacion/.test(text)) return "receta";
  if (/cocina|\bplato\b|\bcomer\b|ingredi|comida|batido|\bjugo\b|nutrici|ensalada/.test(text)) return "cocina";
  if (/dia \d|semana \d|reto|programa|desafio/.test(text)) return "programa";
  if (/postura|movilidad|estiramiento|tecnica|ejecucion/.test(text)) return "tecnica";
  if (/gimnasio|\bgym\b|pesas|mancuernas|entrenamiento|ejercicio|rutina|musculacion|crossfit|pesa\b/.test(text)) return "gym";
  if (/aire libre|exterior|montana|parque|correr|caminar|playa|senderismo|naturaleza|\bcalle\b/.test(text)) return "outdoor";
  if (/mito|realidad|verdad|falso|creencia/.test(text)) return "mito";

  const fromTheme = theme ? mapThemeToCategory(theme) : null;
  if (fromTheme) return fromTheme;

  return "lifestyle";
}
