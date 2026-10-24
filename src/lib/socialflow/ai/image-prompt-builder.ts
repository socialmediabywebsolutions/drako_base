import type { BrandProfile } from "./types";

const TONE_STYLE_MAP: [string, string][] = [
  ["luxury",       "luxury lifestyle photography, elegant minimal composition, premium quality, cinematic lighting"],
  ["premium",      "luxury lifestyle photography, elegant minimal composition, premium quality, cinematic lighting"],
  ["playful",      "vibrant colorful design, dynamic composition, energetic lifestyle photography"],
  ["fun",          "vibrant colorful design, dynamic composition, energetic lifestyle photography"],
  ["tech",         "clean futuristic aesthetic, dark gradient background, neon accent lights, product visualization"],
  ["software",     "clean futuristic aesthetic, dark gradient background, neon accent lights, product visualization"],
  ["health",       "wellness aesthetic, clean white background, fresh natural colors, health lifestyle photography"],
  ["fitness",      "dynamic sports photography, energy in motion, bold colors, athletic lifestyle"],
  ["food",         "food photography, shallow depth of field, warm tones, appetizing presentation, natural lighting"],
  ["fashion",      "editorial fashion photography, high contrast, model silhouette, bold graphic composition"],
  ["minimalist",   "minimal clean design, white background, single focal point, editorial photography"],
  ["bold",         "bold graphic design, high contrast colors, strong visual impact, dynamic composition"],
];

function resolveVisualStyle(tone: string, niche: string): string {
  const combined = `${tone} ${niche}`.toLowerCase();
  for (const [keyword, style] of TONE_STYLE_MAP) {
    if (combined.includes(keyword)) return style;
  }
  return "futuristic digital technology, glowing neon accents, dark background, abstract data visualization, no people, no offices";
}

const SUBJECT_MAX_WORDS = 150;

// El sujeto sale del texto real del post — theme/angle solo son el fallback, porque
// un theme como "errores comunes" no describe ninguna escena concreta.
function resolveSubject(post: { body?: string; angle?: string; theme?: string }, niche: string): string {
  const bodyWords = (post.body ?? "").trim().split(/\s+/).filter(Boolean);
  if (bodyWords.length) return bodyWords.slice(0, SUBJECT_MAX_WORDS).join(" ");
  return post.theme ?? post.angle ?? niche;
}

export function buildImagePrompt(
  post: { body?: string; angle?: string; theme?: string },
  profile: Pick<BrandProfile, "brandIdentity" | "niche" | "toneOfVoice">,
): string {
  const subject = resolveSubject(post, profile.niche);
  const style = resolveVisualStyle(profile.toneOfVoice, profile.niche);

  // El sujeto va al final: CLIP (SDXL) trunca el prompt a ~77 tokens, y con 150
  // palabras de cuerpo delante el estilo y los modificadores quedarían cortados.
  return [
    style,
    "vibrant colors, cinematic lighting, ultra detailed",
    "professional social media marketing image",
    "high quality photorealistic",
    "no text no watermarks",
    `${profile.brandIdentity} brand`,
    `${profile.niche} industry`,
    subject,
  ].join(", ");
}
