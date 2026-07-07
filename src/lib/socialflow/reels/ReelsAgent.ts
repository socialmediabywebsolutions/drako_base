import { defaultLocalModel } from "../ai/models/localModel";
import type { BrandProfile } from "../ai/types";
import { REELS_DEFAULTS, type ReelsConfig, type ReelsEffect, type ReelsTemplate, type ReelsTextOverlay } from "./ReelsEngine";

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

// Dos efectos fijos (movimiento principal + blur de cierre) — mergeAiStructuredOutput
// hace merge posicional sobre arrays de objetos, así que la IA puede ajustar kind/
// intensity/timing de estos dos "slots" pero no añadir un tercero (mismo límite que
// StrategyAgent aplica a horizonDays).
function buildBaseEffects(template: ReelsTemplate, durationSec: number): ReelsEffect[] {
  const primary: ReelsEffect =
    template === "fitness" || template === "motivation"
      ? { kind: "pan-left", startAt: 0, endAt: durationSec, intensity: 0.35 }
      : template === "lifestyle"
      ? { kind: "parallax", startAt: 0, endAt: durationSec, intensity: 0.4 }
      : template === "education"
      ? { kind: "zoom-in", startAt: 0, endAt: durationSec, intensity: 0.2 }
      : { kind: "rotate", startAt: 0, endAt: durationSec, intensity: 0.15 };

  const outro: ReelsEffect = { kind: "blur", startAt: Math.max(0, durationSec - 1), endAt: durationSec, intensity: 0.4 };

  return [primary, outro];
}

function buildBaseTextOverlays(template: ReelsTemplate, durationSec: number, profile: BrandProfile): ReelsTextOverlay[] {
  const animation = TEMPLATE_TEXT_ANIMATION[template];
  const hook = `${profile.brandIdentity}`;
  const pillar = profile.contentPillars[0] ?? profile.niche;

  const third = durationSec / 3;
  return [
    { text: hook, animation, startAt: 0.3, durationSec: Math.max(2, third - 0.5), position: "top" },
    { text: pillar, animation, startAt: third + 0.3, durationSec: Math.max(2, third - 0.5), position: "center" },
    { text: "Sígueme para más", animation: "fade-in", startAt: third * 2 + 0.3, durationSec: Math.max(2, third - 0.8), position: "bottom" },
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
      effects: buildBaseEffects(template, durationSec),
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
