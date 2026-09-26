// Filtro barato de idioma para títulos de YouTube. search.list no devuelve el idioma del
// vídeo, y regionCode=ES + relevanceLanguage=es solo reordenan: con order=viewCount la
// búsqueda "<nicho> reels virales" devolvía sobre todo Shorts indios en hindi/inglés
// rellenos de #viral #shorts, que acababan como "hooks del nicho" y benchmarks de
// clientes hispanohablantes. Heurística, no detección real de idioma: cuenta palabras
// función de español frente a inglés sobre el título sin hashtags.

const SPANISH_MARKERS = new Set([
  "de", "la", "el", "que", "en", "los", "las", "del", "por", "para", "con", "una", "uno", "es",
  "mi", "tu", "su", "lo", "se", "no", "si", "sin", "pero", "como", "cómo", "qué", "más", "muy",
  "este", "esta", "esto", "hoy", "así", "cuando", "porque", "todo", "nunca", "siempre", "mejor",
  "nadie", "tus", "mis", "sus", "al", "también", "hacer", "puedes", "tienes", "aquí", "y", "o",
]);

const ENGLISH_MARKERS = new Set([
  "the", "and", "to", "of", "you", "your", "my", "is", "in", "for", "how", "what", "this", "with",
  "it", "on", "me", "i", "are", "was", "why", "do", "does", "can", "best", "after", "before",
  "at", "be", "from", "that", "every", "will", "who", "try", "get", "out",
]);

const NON_LATIN_LETTERS = /[Ͱ-ϿЀ-ӿ֐-׿؀-ۿऀ-෿฀-๿぀-ヿ㐀-鿿가-힯]/;
const SPANISH_ONLY_CHARS = /[ñ¿¡]/i;

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Título legible para prompt: entidades HTML decodificadas y sin hashtags ni URLs
// (el relleno "#viral #shorts #trending" no aporta nada como hook de referencia).
export function cleanYoutubeTitle(title: string): string {
  return decodeEntities(title)
    .replace(/#\S+/g, " ")
    .replace(/https?:\S+|www\.\S+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s|.·-]+$/, "")
    .trim();
}

export function looksSpanish(text: string): boolean {
  const cleaned = cleanYoutubeTitle(text);
  if (!cleaned || NON_LATIN_LETTERS.test(cleaned)) return false;
  if (SPANISH_ONLY_CHARS.test(cleaned)) return true;

  const words = cleaned.toLowerCase().match(/[a-záéíóúüñ]+/g) ?? [];
  let spanish = 0;
  let english = 0;
  for (const w of words) {
    if (SPANISH_MARKERS.has(w)) spanish++;
    if (ENGLISH_MARKERS.has(w)) english++;
  }
  return spanish > 0 && spanish > english;
}
