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
  return "clean corporate photography, modern office environment, neutral tones, business professional";
}

export function buildImagePrompt(
  post: { body?: string; angle?: string; theme?: string },
  profile: BrandProfile,
): string {
  const subject = post.theme ?? post.angle ?? post.body?.slice(0, 100) ?? profile.niche;
  const style = resolveVisualStyle(profile.toneOfVoice, profile.niche);

  return [
    subject,
    `${profile.brandIdentity} brand`,
    `${profile.niche} industry`,
    style,
    "professional social media marketing image",
    "high quality photorealistic",
    "no text no watermarks no logos",
  ].join(", ");
}
