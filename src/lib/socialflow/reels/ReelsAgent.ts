import { defaultLocalModel } from "../ai/models/localModel";
import type { BrandProfile } from "../ai/types";
import { REELS_DEFAULTS, type ReelsConfig, type ReelsEffect, type ReelsEffectKind, type ReelsTemplate, type ReelsTextOverlay } from "./ReelsEngine";
import { selectMusicTrack } from "./music-selector";

// Capa 3 — decide el ReelsConfig (plantilla, efectos, texto animado, duración) a
// partir del nicho/perfil de marca. Sigue el mismo patrón que StrategyAgent: una base
// determinista por heurística de nicho (nunca falla, no depende de IA) que luego se
// afina con defaultLocalModel.generateStructured (Workers AI con fallback automático).

const FITNESS_RE = /fitness|gym|entrenamiento|ejercicio|pesas|crossfit|yoga|pilates|nutrici[oó]n|salud|wellness|deporte/i;
const EDUCATION_RE = /curso|academia|formaci[oó]n|aprende|tutorial|clase|coaching|mentor[ií]a|ense[ñn]/i;
const MARKETING_RE = /marketing|ventas|negocio|empresa|marca personal|agencia|consultor[ií]a|emprendimiento/i;
const MOTIVATION_RE = /motivaci[oó]n|inspiraci[oó]n|mindset|superaci[oó]n|desarrollo personal|prop[oó]sito/i;

function pickTemplate(profile: BrandProfile): ReelsTemplate {
  const haystack = [profile.niche, profile.shortDescription, ...profile.contentPillars].join(" ");
  if (FITNESS_RE.test(haystack)) return "fitness";
  if (EDUCATION_RE.test(haystack)) return "education";
  if (MARKETING_RE.test(haystack)) return "marketing";
  if (MOTIVATION_RE.test(haystack)) return "motivation";
  return "lifestyle";
}

// Nichos con más "info que transmitir" (educación) piden clips algo más largos;
// fitness/motivación funcionan mejor cortos y punchy.
const TEMPLATE_DURATIONS: Record<ReelsTemplate, number> = {
  fitness: 18,
  motivation: 18,
  lifestyle: 20,
  marketing: 22,
  education: 26,
};

const TEMPLATE_TEXT_ANIMATION: Record<ReelsTemplate, ReelsTextOverlay["animation"]> = {
  fitness: "slide-up",
  motivation: "slide-up",
  lifestyle: "fade-in",
  marketing: "fade-in",
  education: "word-by-word",
};

type EffectProfile = {
  pool: ReelsEffectKind[];
  segmentCount: [min: number, max: number];
  segmentDurationSec: [min: number, max: number];
  intensityRange: [min: number, max: number];
};

// Plantillas "energéticas" (fitness/motivation): segmentos cortos + intensidad alta →
// más cambios de movimiento por segundo. Plantillas "suaves" (lifestyle/education):
// segmentos largos + intensidad baja → transiciones que casi no se notan como corte.
// marketing queda en un punto intermedio (ni deportivo ni relajado).
const TEMPLATE_EFFECT_PROFILE: Record<ReelsTemplate, EffectProfile> = {
  fitness: { pool: ["pan-left", "pan-right", "zoom-in", "rotate"], segmentCount: [3, 4], segmentDurationSec: [2, 4], intensityRange: [0.3, 0.5] },
  motivation: { pool: ["zoom-in", "pan-left", "pan-right", "parallax"], segmentCount: [3, 4], segmentDurationSec: [2, 4], intensityRange: [0.3, 0.5] },
  lifestyle: { pool: ["parallax", "zoom-out", "pan-right"], segmentCount: [2, 3], segmentDurationSec: [4, 7], intensityRange: [0.15, 0.3] },
  education: { pool: ["zoom-in", "parallax"], segmentCount: [2, 3], segmentDurationSec: [5, 9], intensityRange: [0.1, 0.2] },
  marketing: { pool: ["zoom-in", "rotate", "pan-left"], segmentCount: [2, 3], segmentDurationSec: [4, 6], intensityRange: [0.15, 0.3] },
};

const OUTRO_BLUR_SEC = 1;

function pickInRange([min, max]: [number, number], random: () => number): number {
  return min + random() * (max - min);
}

function pickEffectKind(pool: ReelsEffectKind[], lastKind: ReelsEffectKind | null, random: () => number): ReelsEffectKind {
  let kind = pool[Math.floor(random() * pool.length)];
  let attempts = 0;
  while (kind === lastKind && pool.length > 1 && attempts < 5) {
    kind = pool[Math.floor(random() * pool.length)];
    attempts++;
  }
  return kind;
}

// Encadena entre 2 y 4 efectos consecutivos (nunca simultáneos) según el perfil de la
// plantilla, más el mismo blur de cierre de 1s de siempre. mergeAiStructuredOutput hace
// merge posicional sobre arrays de objetos, así que la IA puede seguir ajustando
// kind/intensity/timing de cada segmento, pero la estructura (cuántos, en qué orden)
// la decide este heurístico, no la IA.
function buildChainedEffects(template: ReelsTemplate, durationSec: number, random: () => number = Math.random): ReelsEffect[] {
  const profile = TEMPLATE_EFFECT_PROFILE[template];
  const mainDurationSec = Math.max(1, durationSec - OUTRO_BLUR_SEC);
  const segmentCount = clamp(Math.round(pickInRange(profile.segmentCount, random)), 2, 4);

  const segments: ReelsEffect[] = [];
  let cursor = 0;
  let lastKind: ReelsEffectKind | null = null;

  for (let i = 0; i < segmentCount; i++) {
    const isLast = i === segmentCount - 1;
    const remaining = mainDurationSec - cursor;
    const remainingSegmentsAfterThis = segmentCount - i - 1;
    const segDuration = isLast
      ? Math.max(0.5, remaining)
      : Math.max(0.5, Math.min(remaining - remainingSegmentsAfterThis * 0.5, pickInRange(profile.segmentDurationSec, random)));

    const kind = pickEffectKind(profile.pool, lastKind, random);
    lastKind = kind;

    segments.push({
      kind,
      startAt: Number(cursor.toFixed(2)),
      endAt: Number(Math.min(mainDurationSec, cursor + segDuration).toFixed(2)),
      intensity: Number(pickInRange(profile.intensityRange, random).toFixed(2)),
    });

    cursor += segDuration;
  }

  const outro: ReelsEffect = { kind: "blur", startAt: Math.max(0, durationSec - OUTRO_BLUR_SEC), endAt: durationSec, intensity: 0.4 };

  return [...segments, outro];
}

const CTA_ENERGETIC: [string, string, string] = ["Sígueme para más 🔥", "Guárdalo 📌", "Comparte con alguien que lo necesite 💪"];

// fitness y motivation comparten pool (ambas son plantillas "energéticas").
const CTA_POOL: Record<ReelsTemplate, [string, string, string]> = {
  fitness: CTA_ENERGETIC,
  motivation: CTA_ENERGETIC,
  lifestyle: ["Sígueme para más ✨", "Guárdalo para después 🌿", "¿Te identificas? Cuéntame 💬"],
  education: ["Sígueme para más tips 📚", "Guárdalo 📌", "¿Lo sabías? Comenta 👇"],
  marketing: ["Sígueme para más 🚀", "Compártelo 🔁", "Guárdalo para después ⭐"],
};

// Rotación determinista (no aleatoria) para que dos llamadas en el mismo segundo no
// muestren CTAs distintos de forma inconsistente entre reintentos.
function pickCta(template: ReelsTemplate): string {
  return CTA_POOL[template][Date.now() % 3];
}

function buildBaseTextOverlays(template: ReelsTemplate, durationSec: number, profile: BrandProfile): ReelsTextOverlay[] {
  const animation = TEMPLATE_TEXT_ANIMATION[template];
  const hook = `${profile.brandIdentity}`;
  const pillar = profile.contentPillars[0] ?? profile.niche;
  const cta = pickCta(template);

  const third = durationSec / 3;
  return [
    { text: hook, role: "title", animation, startAt: 0.3, durationSec: Math.max(2, third - 0.5), position: "top" },
    { text: pillar, role: "subtitle", animation, startAt: third + 0.3, durationSec: Math.max(2, third - 0.5), position: "center" },
    { text: cta, role: "cta", animation: "fade-in", startAt: third * 2 + 0.3, durationSec: Math.max(2, third - 0.8), position: "bottom" },
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Re-acota lo que devuelva la IA a los límites reales del engine, y fuerza de vuelta
// imageUrl/width/height — nunca deben depender de lo que "invente" el modelo.
function sanitizeConfig(config: ReelsConfig, imageUrl: string): ReelsConfig {
  const durationSec = clamp(
    Math.round(config.durationSec || REELS_DEFAULTS.minDurationSec),
    REELS_DEFAULTS.minDurationSec,
    REELS_DEFAULTS.maxDurationSec,
  );

  return {
    ...config,
    imageUrl,
    width: REELS_DEFAULTS.width,
    height: REELS_DEFAULTS.height,
    fps: clamp(Math.round(config.fps || REELS_DEFAULTS.fps), REELS_DEFAULTS.minFps, REELS_DEFAULTS.maxFps),
    durationSec,
    musicTrackUrl: selectMusicTrack(config.template),
    effects: config.effects.map((e) => ({ ...e, startAt: clamp(e.startAt, 0, durationSec), endAt: clamp(e.endAt, 0, durationSec) })),
    textOverlays: config.textOverlays
      .filter((t) => t.text.trim().length > 0)
      .map((t) => ({ ...t, startAt: clamp(t.startAt, 0, durationSec), durationSec: clamp(t.durationSec, 0.5, durationSec) })),
  };
}

export class ReelsAgent {
  async run(input: { imageUrl: string; profile: BrandProfile }): Promise<ReelsConfig> {
    const { imageUrl, profile } = input;

    const template = pickTemplate(profile);
    const durationSec = TEMPLATE_DURATIONS[template];

    const base: ReelsConfig = {
      imageUrl,
      template,
      effects: buildChainedEffects(template, durationSec),
      textOverlays: buildBaseTextOverlays(template, durationSec, profile),
      durationSec,
      fps: REELS_DEFAULTS.fps,
      width: REELS_DEFAULTS.width,
      height: REELS_DEFAULTS.height,
    };

    const prompt = `Decide la configuración de un Reel (vídeo corto vertical) para una marca de "${profile.niche}" llamada "${profile.brandIdentity}".
Tono: ${profile.toneOfVoice}.

La plantilla debe ser exactamente una de: "fitness", "lifestyle", "motivation", "education", "marketing" — la que mejor encaje con el nicho.
Cada efecto debe ser uno de: "zoom-in", "zoom-out", "pan-left", "pan-right", "parallax", "rotate", "blur", con startAt/endAt en segundos dentro de la duración del clip e intensity entre 0 y 1.
Cada texto animado (textOverlays) debe tener una frase corta y directa EN ESPAÑOL (máximo 6 palabras), relevante para "${profile.niche}" y la marca "${profile.brandIdentity}" — nunca genérica.
La duración total (durationSec) debe estar entre ${REELS_DEFAULTS.minDurationSec} y ${REELS_DEFAULTS.maxDurationSec} segundos.`;

    const { data } = await defaultLocalModel.generateStructured<ReelsConfig>({ prompt }, () => base);

    return sanitizeConfig(data, imageUrl);
  }
}
