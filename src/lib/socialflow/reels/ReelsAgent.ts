import { defaultLocalModel } from "../ai/models/localModel";
import type { BrandProfile } from "../ai/types";
import { extractVoiceSection } from "../ai/utils/voiceUtils";
import { getNicheIntelligence, getStyleHistory } from "@/lib/socialflow/intelligence/NicheIntelligenceService";
import { extractTrendSignals } from "@/lib/socialflow/intelligence/TrendKeywordAgent";
import { env } from "@/lib/cf";
import { reportSocialflowAiUsage } from "@/lib/ai/usage";
import { seededRandom } from "./seededRandom";
import {
  REELS_DEFAULTS,
  type AnimatedBackgroundType,
  type ReelsColorGrade,
  type ReelsConfig,
  type ReelsEffect,
  type ReelsEffectKind,
  type ReelsImageSegment,
  type ReelsTemplate,
  type ReelsTextAnimationKind,
  type ReelsTextOverlay,
  type ReelsTextRole,
} from "./ReelsEngine";
import { selectMusicTrack, type MusicTrackDeps } from "./music-selector";

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

// "pan" es un marcador de pool que se resuelve a "pan-left" o "pan-right" al azar en el
// momento de la elección (ver resolveEffectKind) — antes pan-left/pan-right ocupaban 2
// casillas del pool (el doble de probabilidad que cualquier otro efecto individual, ver
// audit del bug "se usa un montón"); ahora ocupan 1 sola, igual que el resto, sin perder
// la variedad de dirección.
type EffectPoolKind = ReelsEffectKind | "pan";

type EffectProfile = {
  pool: EffectPoolKind[];
  segmentCount: [min: number, max: number];
  segmentDurationSec: [min: number, max: number];
  intensityRange: [min: number, max: number];
};

// Plantillas "energéticas" (fitness/motivation): segmentos cortos + intensidad alta →
// más cambios de movimiento por segundo. Plantillas "suaves" (lifestyle/education):
// segmentos largos + intensidad baja → transiciones que casi no se notan como corte.
// marketing queda en un punto intermedio (ni deportivo ni relajado).
//
// Los 11 tipos de movimiento (todo ReelsEffectKind salvo pan-left/pan-right, que ya no se
// usan — ver auditoría de movimiento lateral —, y blur/flash/wipe, que son otra categoría:
// blur no es un "movimiento" seleccionable por pool y flash/wipe son transiciones de
// cierre, ver OUTRO_TRANSITION_POOL) están disponibles en las 5 plantillas — mismo patrón
// "pool pesado por repetición + pickFrom(pool, seededRandom)" que ANIMATED_BG_POOLS, en vez
// de listas fijas distintas por plantilla: cada plantilla pesa hacia el carácter que le
// corresponde (fitness/motivation hacia zoom-pulse/zoom-in/rotate, energético;
// lifestyle/education hacia zoom-breathe/vertical-drift/zoom-out, suave; marketing hacia
// zoom-pulse/zoom-in/vertical-drift, intermedio) pero cualquier tipo puede salir en
// cualquier plantilla, solo con menos frecuencia.
const TEMPLATE_EFFECT_PROFILE: Record<ReelsTemplate, EffectProfile> = {
  fitness: {
    pool: [
      "zoom-in", "zoom-in", "zoom-in",
      "zoom-pulse", "zoom-pulse", "zoom-pulse",
      "rotate", "rotate",
      "zoom-breathe", "vertical-drift", "parallax", "ken-burns", "drift", "tilt", "zoom-out", "pulse",
    ],
    segmentCount: [3, 4],
    segmentDurationSec: [2, 4],
    intensityRange: [0.3, 0.5],
  },
  lifestyle: {
    pool: [
      "zoom-breathe", "zoom-breathe", "zoom-breathe",
      "zoom-out", "zoom-out", "zoom-out",
      "vertical-drift", "vertical-drift",
      "zoom-pulse", "zoom-pulse",
      "rotate", "parallax", "ken-burns", "drift", "tilt", "zoom-in", "pulse",
    ],
    segmentCount: [2, 3],
    segmentDurationSec: [4, 7],
    intensityRange: [0.15, 0.3],
  },
  motivation: {
    pool: [
      "zoom-pulse", "zoom-pulse", "zoom-pulse",
      "zoom-in", "zoom-in", "zoom-in",
      "rotate", "rotate",
      "zoom-breathe", "zoom-breathe",
      "vertical-drift", "parallax", "ken-burns", "drift", "tilt", "zoom-out", "pulse",
    ],
    segmentCount: [3, 4],
    segmentDurationSec: [2, 4],
    intensityRange: [0.3, 0.5],
  },
  education: {
    pool: [
      "zoom-breathe", "zoom-breathe", "zoom-breathe",
      "vertical-drift", "vertical-drift", "vertical-drift",
      "zoom-out", "zoom-out",
      "zoom-in", "zoom-in",
      "rotate", "zoom-pulse", "parallax", "ken-burns", "drift", "tilt", "pulse",
    ],
    segmentCount: [2, 3],
    segmentDurationSec: [5, 9],
    intensityRange: [0.1, 0.2],
  },
  marketing: {
    pool: [
      "zoom-pulse", "zoom-pulse", "zoom-pulse",
      "zoom-in", "zoom-in", "zoom-in",
      "vertical-drift", "vertical-drift",
      "rotate", "rotate",
      "zoom-breathe", "zoom-out", "parallax", "ken-burns", "drift", "tilt", "pulse",
    ],
    segmentCount: [2, 3],
    segmentDurationSec: [4, 6],
    intensityRange: [0.15, 0.3],
  },
};

// "drift" debe ser casi imperceptible siempre, incluso en plantillas "energéticas" que
// piden 0.3-0.5 de intensidad para el resto de sus efectos — este override reemplaza el
// intensityRange de la plantilla solo cuando el efecto elegido para el segmento es drift.
const EFFECT_INTENSITY_OVERRIDE: Partial<Record<ReelsEffectKind, [min: number, max: number]>> = {
  drift: [0.05, 0.15],
};

// Pool de color grading por plantilla, mismo patrón pool+seed que OUTRO_TRANSITION_POOL
// pero decidido UNA VEZ para todo el clip (no por segmento/efecto) — es una decisión
// estética del Reel completo, no una transición puntual. Sesgado hacia "none" en todas
// las plantillas para que el filtro sea la excepción, no la norma; fitness/education
// priorizan energía/legibilidad (solo "none"), lifestyle/marketing tienen más variedad
// (estética más "editorial" encaja mejor con esos nichos).
const TEMPLATE_COLOR_GRADE_POOL: Record<ReelsTemplate, ReelsColorGrade[]> = {
  fitness: ["none", "none", "none"],
  motivation: ["none", "none", "vignette"],
  lifestyle: ["none", "sepia", "vignette"],
  education: ["none", "none"],
  marketing: ["none", "bw"],
};

// Pools de filmGrain/lightLeak — mismo patrón pool+seed que TEMPLATE_COLOR_GRADE_POOL,
// pero ORTOGONALES a colorGrade (no compiten por el mismo eje: grano/light leak son
// aditivos, se pueden combinar con cualquier colorGrade, ej. sepia+grano = look vintage).
// Mismo criterio de sesgo por plantilla: fitness/education priorizan energía/legibilidad
// (nunca), lifestyle/motivation tienen más variedad (estética editorial/cinematográfica).
const TEMPLATE_FILM_GRAIN_POOL: Record<ReelsTemplate, boolean[]> = {
  fitness: [false, false, false],
  motivation: [false, false, true],
  lifestyle: [false, true, true],
  education: [false, false, false],
  marketing: [false, false, false],
};

const TEMPLATE_LIGHT_LEAK_POOL: Record<ReelsTemplate, boolean[]> = {
  fitness: [false, false, false],
  motivation: [false, false, true],
  lifestyle: [false, false, true],
  education: [false, false, false],
  marketing: [false, false, false],
};

// Pool de fondo animado por plantilla — mismo patrón pool+seed que TEMPLATE_COLOR_GRADE_POOL/
// TEMPLATE_FILM_GRAIN_POOL/TEMPLATE_LIGHT_LEAK_POOL, pero "pesado" por repetición en vez de
// boolean: cada tipo aparece tantas veces como su peso, así pickFrom (uniforme sobre el
// array) le da más probabilidad sin necesitar una tabla de pesos aparte. fitness/motivation
// pesan hacia particles/sparks/pulse-waves (energía); lifestyle hacia bokeh/aurora/smoke
// (editorial/suave); education hacia gradient-wave/geometric-lines (limpio, no distrae del
// contenido); marketing hacia geometric-lines/glitch (corporativo/técnico). Los 12 tipos
// están siempre presentes en los 5 pools, solo cambia el peso.
//
// "particles", "sparks", "bokeh", "geometric-lines", "smoke" y "aurora" habían salido de
// aquí (ver auditoría de movimiento lateral) porque sus draw*Layer en CanvasRenderer.ts
// tenían Math.sin/cos afectando la posición X (o, en geometric-lines, un scroll lateral
// explícito). Ya están arreglados (drawParticlesLayer/drawSparksLayer/drawBokehLayer/
// drawGeometricLinesLayer/drawSmokeLayer/drawAuroraLayer solo animan Y, escala u opacidad
// ahora — ningún punto se desplaza en X) y vuelven al pool con el mismo peso que tenían
// antes de quitarlos.
const ANIMATED_BG_POOLS: Record<ReelsTemplate, AnimatedBackgroundType[]> = {
  fitness: [
    "particles", "particles", "particles",
    "sparks", "sparks", "sparks",
    "pulse-waves", "pulse-waves",
    "stars", "stars",
    "bokeh", "geometric-lines", "gradient-wave", "water-waves", "smoke", "confetti", "glitch", "aurora",
  ],
  lifestyle: [
    "bokeh", "bokeh", "bokeh",
    "aurora", "aurora", "aurora",
    "smoke", "smoke",
    "water-waves", "water-waves",
    "stars", "stars",
    "gradient-wave", "gradient-wave",
    "particles", "confetti", "sparks", "pulse-waves", "geometric-lines", "glitch",
  ],
  motivation: [
    "particles", "particles", "particles",
    "sparks", "sparks", "sparks",
    "pulse-waves", "pulse-waves", "pulse-waves",
    "stars", "stars",
    "bokeh", "aurora", "gradient-wave", "water-waves", "smoke", "geometric-lines", "confetti", "glitch",
  ],
  education: [
    "gradient-wave", "gradient-wave", "gradient-wave",
    "geometric-lines", "geometric-lines", "geometric-lines",
    "water-waves", "water-waves",
    "smoke", "smoke",
    "stars", "stars",
    "bokeh", "particles", "pulse-waves", "aurora", "confetti", "sparks", "glitch",
  ],
  marketing: [
    "geometric-lines", "geometric-lines", "geometric-lines",
    "glitch", "glitch", "glitch",
    "gradient-wave", "gradient-wave",
    "pulse-waves", "pulse-waves",
    "stars", "stars",
    "bokeh", "particles", "sparks", "aurora", "water-waves", "smoke", "confetti",
  ],
};

const OUTRO_TRANSITION_SEC = 1;

// Pool de transiciones de cierre — antes siempre "blur" fijo, ahora rota entre 3 estilos
// con el mismo patrón pool+elección que ya usan los efectos de imagen (pickFrom + random
// seeded por imagen, así que el mismo Reel sale siempre igual, distinto entre imágenes).
// "flash"/"wipe" se renderizan como overlay en CanvasRenderer (ver drawTransitionOverlay).
const OUTRO_TRANSITION_POOL: Extract<ReelsEffectKind, "blur" | "flash" | "wipe">[] = ["blur", "flash", "wipe"];

function pickInRange([min, max]: [number, number], random: () => number): number {
  return min + random() * (max - min);
}

function pickFrom<T>(pool: readonly T[], random: () => number): T {
  return pool[Math.floor(random() * pool.length)];
}

// Elige del pool evitando repetir la MISMA casilla que el segmento anterior (lastPoolKind
// es el marcador crudo, ej. "pan", no la dirección ya resuelta) — así "pan" seguido de
// "pan" sigue bloqueado como antes, independientemente de qué dirección le toque a cada uno.
function pickEffectKind(pool: EffectPoolKind[], lastPoolKind: EffectPoolKind | null, random: () => number): EffectPoolKind {
  let kind = pool[Math.floor(random() * pool.length)];
  let attempts = 0;
  while (kind === lastPoolKind && pool.length > 1 && attempts < 5) {
    kind = pool[Math.floor(random() * pool.length)];
    attempts++;
  }
  return kind;
}

// Resuelve el marcador "pan" a una dirección concreta al azar (misma probabilidad cada
// vez que sale elegido) — CanvasRenderer solo conoce "pan-left"/"pan-right" como kinds
// reales, esto es puramente una decisión de ReelsAgent al construir el ReelsEffect.
function resolveEffectKind(kind: EffectPoolKind, random: () => number): ReelsEffectKind {
  return kind === "pan" ? (random() < 0.5 ? "pan-left" : "pan-right") : kind;
}

// Encadena entre 2 y 4 efectos consecutivos (nunca simultáneos) según el perfil de la
// plantilla, más el mismo blur/flash/wipe de cierre de 1s de siempre — SOLO cuando
// includeOutro es true. mergeAiStructuredOutput hace merge posicional sobre arrays de
// objetos, así que la IA puede seguir ajustando kind/intensity/timing de cada segmento,
// pero la estructura (cuántos, en qué orden) la decide este heurístico con `random`
// (seededRandom por imagen), no la IA.
//
// includeOutro=false (ver buildMultiImageEffects): grupos internos de un Reel
// multi-imagen ya no llevan blur/flash/wipe de cierre — el corte a la siguiente imagen
// ahora lo resuelve el crossfade real (ver CROSSFADE_SEC/crossfadeStateAtTime en
// CanvasRenderer.ts), y blur/flash/wipe + crossfade simultáneos en el mismo corte se
// pisarían (wipe taparía el blend, flash lo blanquearía) sin aportar nada. Sin reserva de
// OUTRO_TRANSITION_SEC tampoco: los efectos ocupan el tramo completo del segmento.
function buildChainedEffects(
  template: ReelsTemplate,
  durationSec: number,
  random: () => number = Math.random,
  includeOutro: boolean = true,
): ReelsEffect[] {
  const profile = TEMPLATE_EFFECT_PROFILE[template];
  const mainDurationSec = includeOutro ? Math.max(1, durationSec - OUTRO_TRANSITION_SEC) : durationSec;
  const segmentCount = clamp(Math.round(pickInRange(profile.segmentCount, random)), 2, 4);

  const segments: ReelsEffect[] = [];
  let cursor = 0;
  let lastPoolKind: EffectPoolKind | null = null;

  for (let i = 0; i < segmentCount; i++) {
    const isLast = i === segmentCount - 1;
    const remaining = mainDurationSec - cursor;
    const remainingSegmentsAfterThis = segmentCount - i - 1;
    const segDuration = isLast
      ? Math.max(0.5, remaining)
      : Math.max(0.5, Math.min(remaining - remainingSegmentsAfterThis * 0.5, pickInRange(profile.segmentDurationSec, random)));

    const poolKind = pickEffectKind(profile.pool, lastPoolKind, random);
    lastPoolKind = poolKind;
    const kind = resolveEffectKind(poolKind, random);
    const intensityRange = EFFECT_INTENSITY_OVERRIDE[kind] ?? profile.intensityRange;

    segments.push({
      kind,
      startAt: Number(cursor.toFixed(2)),
      endAt: Number(Math.min(mainDurationSec, cursor + segDuration).toFixed(2)),
      intensity: Number(pickInRange(intensityRange, random).toFixed(2)),
    });

    cursor += segDuration;
  }

  if (!includeOutro) {
    return segments;
  }

  const outroKind = pickFrom(OUTRO_TRANSITION_POOL, random);
  const outro: ReelsEffect = { kind: outroKind, startAt: Math.max(0, durationSec - OUTRO_TRANSITION_SEC), endAt: durationSec, intensity: 0.4 };

  return [...segments, outro];
}

// PARTE 4 (base multi-imagen): un grupo de segmentos independiente por imagen, cada uno
// con su propio seed (misma imagen → mismos efectos siempre, imagen distinta → efectos
// distintos), concatenados y desplazados en el tiempo para cubrir su propio tramo del
// clip. Solo el ÚLTIMO grupo lleva blur/flash/wipe de cierre (includeOutro=true) — es el
// cierre real del clip completo, donde no hay "imagen siguiente" con la que hacer
// crossfade. Los cortes INTERNOS entre imágenes ya no llevan ese cierre (includeOutro=
// false): los resuelve el crossfade real de CanvasRenderer.ts (ver CROSSFADE_SEC), que
// sustituye por completo al antiguo blur/flash/wipe rotado en esos cortes. CanvasRenderer
// usa imageSegments para saber qué imagen dibujar en cada tramo (ver CanvasRenderer.render
// → imageIndexForTime/crossfadeStateAtTime).
function buildMultiImageEffects(
  template: ReelsTemplate,
  durationSec: number,
  imageUrls: string[],
): { effects: ReelsEffect[]; imageSegments: ReelsImageSegment[] } {
  const perImageDuration = durationSec / imageUrls.length;
  const effects: ReelsEffect[] = [];
  const imageSegments: ReelsImageSegment[] = [];

  imageUrls.forEach((url, i) => {
    const isLastImage = i === imageUrls.length - 1;
    const segStart = i * perImageDuration;
    const segEnd = isLastImage ? durationSec : (i + 1) * perImageDuration;
    const groupEffects = buildChainedEffects(template, segEnd - segStart, seededRandom(url), isLastImage);
    for (const effect of groupEffects) {
      effects.push({
        ...effect,
        startAt: Number((effect.startAt + segStart).toFixed(2)),
        endAt: Number((effect.endAt + segStart).toFixed(2)),
      });
    }
    imageSegments.push({ imageUrl: url, startAt: Number(segStart.toFixed(2)), endAt: Number(segEnd.toFixed(2)) });
  });

  return { effects, imageSegments };
}

const CTA_ENERGETIC = [
  "¿Tú también lo sientes?",
  "Comenta tu experiencia 👇",
  "¿Cuánto tiempo llevas entrenando?",
  "Guarda esto para tu próxima sesión 💪",
  "Etiqueta a alguien que necesita ver esto",
  "¿Empezamos juntos?",
  "Comparte si te identifica",
  "¿Cuál es tu mayor reto?",
];

// fitness y motivation comparten pool (ambas son plantillas "energéticas").
const CTA_POOL: Record<ReelsTemplate, string[]> = {
  fitness: CTA_ENERGETIC,
  motivation: CTA_ENERGETIC,
  lifestyle: [
    "¿Tú cómo lo vives?",
    "Cuéntame en comentarios 👇",
    "Guarda para inspirarte",
    "¿Te identificas?",
    "Etiqueta a quien necesita esto",
    "¿Cuál es tu momento favorito del día?",
    "Comparte tu experiencia",
    "¿Qué opinas?",
  ],
  education: [
    "¿Lo sabías?",
    "Guarda para no olvidarlo 📌",
    "¿Tienes dudas? Pregunta 👇",
    "Comparte con quien lo necesite",
    "¿Cuál es tu experiencia?",
    "Etiqueta a alguien curioso",
    "¿Qué más quieres aprender?",
    "Comenta tu opinión",
  ],
  marketing: [
    "¿Te ayudamos?",
    "Escríbenos 👇",
    "Reserva tu lugar ahora",
    "Pregunta sin compromiso",
    "Contáctanos hoy",
    "¿Quieres saber más?",
    "Etiqueta a quien le interese",
    "Empieza hoy",
  ],
};

// Antes era una rotación determinista por Date.now() % 3 (mismo pool de 3, sin
// variación real entre Reels). Ahora sale del mismo seededRandom que efectos/tipografía
// — 8 frases por plantilla, reproducible por imagen.
function pickCta(template: ReelsTemplate, random: () => number): string {
  return pickFrom(CTA_POOL[template], random);
}

// Solo el título varía de posición hoy — subtítulo/CTA se quedan en su default de rol
// (center/bottom) para no romper la jerarquía visual de 3 capas.
const TITLE_POSITIONS: NonNullable<ReelsTextOverlay["position"]>[] = ["top", "top-center", "upper-center"];

// Animaciones de entrada permitidas por rol — deben existir en ReelsTextAnimationKind
// (ReelsEngine.ts) y ser manejadas por computeEntryAnimation en CanvasRenderer.ts.
const ROLE_ANIMATION_POOL: Record<ReelsTextRole, ReelsTextAnimationKind[]> = {
  title: ["slide-down", "fade-in", "word-by-word"],
  subtitle: ["fade-in", "zoom", "slide-up"],
  cta: ["fade-in", "slide-up", "typewriter"],
};

// Mismos valores base que TEXT_ROLE_STYLE en CanvasRenderer.ts — duplicados a propósito
// (Capa 3 no importa de Capa 2, que solo puede ejecutarse en el navegador) en vez de
// mover TEXT_ROLE_STYLE a ReelsEngine.ts, para no ampliar la superficie tocada del
// renderer que ya está en producción.
const ROLE_BASE_FONT_SIZE: Record<ReelsTextRole, number> = {
  title: 180,
  subtitle: 130,
  cta: 90,
};

function pickFontSize(role: ReelsTextRole, random: () => number): number {
  return Math.round(ROLE_BASE_FONT_SIZE[role] * (0.9 + random() * 0.2)); // ±10%
}

function buildBaseTextOverlays(
  template: ReelsTemplate,
  durationSec: number,
  profile: BrandProfile,
  random: () => number,
): ReelsTextOverlay[] {
  const hook = `${profile.brandIdentity}`;
  const pillar = profile.contentPillars[0] ?? profile.niche;
  const cta = pickCta(template, random);

  const titlePosition = pickFrom(TITLE_POSITIONS, random);
  const titleAnimation = pickFrom(ROLE_ANIMATION_POOL.title, random);
  const subtitleAnimation = pickFrom(ROLE_ANIMATION_POOL.subtitle, random);
  const ctaAnimation = pickFrom(ROLE_ANIMATION_POOL.cta, random);

  const titleFontSize = pickFontSize("title", random);
  const subtitleFontSize = pickFontSize("subtitle", random);
  const ctaFontSize = pickFontSize("cta", random);

  const third = durationSec / 3;
  return [
    { text: hook, role: "title", animation: titleAnimation, startAt: 0.3, durationSec: Math.max(2, third - 0.5), position: titlePosition, fontSize: titleFontSize },
    { text: pillar, role: "subtitle", animation: subtitleAnimation, startAt: third + 0.3, durationSec: Math.max(2, third - 0.5), position: "center", fontSize: subtitleFontSize },
    { text: cta, role: "cta", animation: ctaAnimation, startAt: third * 2 + 0.3, durationSec: Math.max(2, third - 0.8), position: "bottom", fontSize: ctaFontSize },
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Mismo criterio que CarouselComposerAgent.ts (parseLatestStyleSnapshot) — parser local
// en vez de importar StyleLearningAgent, solo necesitamos topHookPatterns aquí.
function parseTopHookPatterns(snapshotJson: string): string[] {
  try {
    const parsed = JSON.parse(snapshotJson);
    const patterns = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).topHookPatterns : null;
    return Array.isArray(patterns) ? patterns.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

// --- TTS Voice Narration ---

type NarrationScriptPayload = { script: string };

// generateStructured() decora el resultado con _meta.engine — mismo criterio que
// SeasonalityAgent/NicheIntelligenceCronAgent: "workers-ai" en una respuesta real,
// "local-deterministic-stub" ante cualquier fallo. Nunca se sintetiza voz a partir del
// seed vacío del stub.
type NarrationScriptResult = NarrationScriptPayload & { _meta?: { engine?: string } };

// Voz válida de @cf/deepgram/aura-2-es (ver Ai_Cf_Deepgram_Aura_2_Es_Input en
// @cloudflare/workers-types — el campo se llama `speaker`, no `voice`, y sus únicos
// valores válidos son sirio/nestor/carina/celeste/alvaro/diana/aquila/selena/estrella/
// javier; "asteria" no existe en este modelo, es una voz de Aura-1 en inglés).
const NARRATION_SPEAKER = "carina";
const NARRATION_MODEL = "@cf/deepgram/aura-2-es";

function buildNarrationPrompt(niche: string, tema: string, seasonalContext: string | undefined): string {
  return `Escribe un guion corto de narración en off para un Reel de Instagram de una marca de "${niche}". El tema de este Reel es: "${tema}".

Debe sonar como algo pensado para ESCUCHARSE en voz alta, no para leerse como texto — frases cortas, ritmo natural al hablar, nunca una lista ni el texto de un caption. Escribe en primera persona, con un gancho emocional que conecte con la audiencia desde la primera frase.
${seasonalContext ? `\nContexto estacional del mes (JSON, úsalo solo si encaja de forma natural, no lo fuerces):\n${seasonalContext}\n` : ""}
Máximo 3 frases, entre 25 y 40 palabras en total.

Responde SOLO con un objeto JSON válido, sin markdown, sin backticks, con esta forma exacta:
{"script": "el guion aquí"}

Responde en español.`;
}

// @cf/deepgram/aura-2-es devuelve el MP3 como string en base64 (Ai_Cf_Deepgram_Aura_2_Es_Output
// = string en @cloudflare/workers-types), no un ArrayBuffer — hay que decodificarlo antes de
// subirlo a R2. Mismo patrón Buffer-o-atob que token-encryption.ts:base64Decode (duplicado
// aquí en vez de importado porque no lo exporta).
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof Buffer !== "undefined") {
    const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

// Tablas MPEG1/2 Layer III (bitrate en kbps y sample rate en Hz por índice del frame
// header) — necesarias para estimar la duración del MP3 sin decodificarlo (Workers no
// tiene un decoder de audio nativo ni acceso a librerías tipo music-metadata).
const MP3_BITRATES_KBPS: Record<"mpeg1" | "mpeg2", number[]> = {
  mpeg1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  mpeg2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
};
const MP3_SAMPLE_RATES_HZ: Record<"mpeg1" | "mpeg2" | "mpeg25", number[]> = {
  mpeg1: [44100, 48000, 32000, 0],
  mpeg2: [22050, 24000, 16000, 0],
  mpeg25: [11025, 12000, 8000, 0],
};

// Duración aproximada a partir del primer frame header MP3 válido: bitrate real del
// stream (CBR — @cf/deepgram/aura-2-es no produce VBR) contra los bytes de audio
// restantes. Salta un tag ID3v2 inicial si lo hubiera. Devuelve null si no encuentra un
// frame Layer III reconocible — el caller trata la duración como opcional.
function estimateMp3DurationSeconds(buffer: ArrayBuffer): number | null {
  const bytes = new Uint8Array(buffer);
  let offset = 0;

  if (bytes.length > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const tagSize =
      ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
    offset = 10 + tagSize;
  }

  for (let i = offset; i < bytes.length - 4; i += 1) {
    if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) continue;

    const versionBits = (bytes[i + 1] >> 3) & 0x3;
    const layerBits = (bytes[i + 1] >> 1) & 0x3;
    if (layerBits !== 0x1) continue; // Solo Layer III

    const version = versionBits === 0x3 ? "mpeg1" : versionBits === 0x2 ? "mpeg2" : versionBits === 0x0 ? "mpeg25" : null;
    if (!version) continue; // 0x1 es "reserved"

    const bitrateIndex = (bytes[i + 2] >> 4) & 0xf;
    const sampleRateIndex = (bytes[i + 2] >> 2) & 0x3;
    const bitrateKbps = (version === "mpeg1" ? MP3_BITRATES_KBPS.mpeg1 : MP3_BITRATES_KBPS.mpeg2)[bitrateIndex];
    const sampleRate = MP3_SAMPLE_RATES_HZ[version][sampleRateIndex];
    if (!bitrateKbps || !sampleRate) continue;

    const audioBytes = bytes.length - i;
    return Math.round((audioBytes * 8) / (bitrateKbps * 1000));
  }

  return null;
}

// Genera un guion corto (Mistral) y lo sintetiza a voz (@cf/deepgram/aura-2-es), subiendo
// el MP3 a R2 — mismo bucket/URL pública que ya usa media/upload/route.ts para cualquier
// otro asset. Nunca lanza: cualquier fallo en cualquier paso (bindings ausentes, Mistral,
// TTS, R2) devuelve undefined y el Reel se genera con música solamente, exactamente igual
// que si este sprint no existiera — nunca bloquea ni degrada el resto del Reel.
// Exportada — también la reutiliza processAiVideoJob en
// workers/socialflow-ai-worker/src/index.ts para la narración del flujo de Vídeo IA
// (Real Video Generation), mismo guion+TTS+R2 que el Reel con efectos.
export async function generateNarrationTrackUrl(input: {
  niche: string;
  tema: string;
  seasonalContext: string | undefined;
  tenantId: string | undefined;
  saasId: string | undefined;
}): Promise<string | undefined> {
  try {
    if (!input.tenantId) return undefined;

    const dracoEnv = env();
    const bucket = dracoEnv?.SOCIAL_MEDIA_BUCKET;
    const baseUrl = dracoEnv?.SOCIAL_MEDIA_R2_PUBLIC_URL?.trim();
    const aiBinding = dracoEnv?.AI;
    if (!bucket || !baseUrl || !aiBinding?.run) return undefined;

    const seed: NarrationScriptPayload = { script: "" };
    const { data } = await defaultLocalModel.generateStructured<NarrationScriptResult>(
      {
        prompt: buildNarrationPrompt(input.niche, input.tema, input.seasonalContext),
        tenantId: input.tenantId,
        saasId: input.saasId,
      },
      () => seed as NarrationScriptResult,
    );
    const script = data.script?.trim();
    if (data._meta?.engine !== "workers-ai" || !script) return undefined;

    const ttsResult = await aiBinding.run(NARRATION_MODEL, {
      text: script,
      speaker: NARRATION_SPEAKER,
      encoding: "mp3",
    });
    if (typeof ttsResult !== "string" || !ttsResult) return undefined;

    const audioBuffer = base64ToArrayBuffer(ttsResult);
    const key = `reels/narration/${input.tenantId}/${Date.now()}.mp3`;
    await bucket.put(key, audioBuffer, { httpMetadata: { contentType: "audio/mpeg" } });

    void reportSocialflowAiUsage({
      tenantId: input.tenantId,
      agent: "TTS",
      model: NARRATION_MODEL,
      durationSeconds: estimateMp3DurationSeconds(audioBuffer) ?? undefined,
    });

    return `${baseUrl.replace(/\/$/, "")}/${key}`;
  } catch (error) {
    console.error("[ReelsAgent] generateNarrationTrackUrl failed", error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

// Re-acota lo que devuelva la IA a los límites reales del engine, y fuerza de vuelta
// imageUrl/imageUrls/imageSegments/width/height — nunca deben depender de lo que
// "invente" el modelo (mergeAiStructuredOutput deja que la IA reemplace arrays de
// strings como imageUrls si los incluye en su respuesta — ver localModel.ts).
async function sanitizeConfig(
  config: ReelsConfig,
  imageUrl: string,
  music: MusicTrackDeps | undefined,
  handle: string,
  niche: string,
  seasonalContext: string | undefined,
  tenantId: string | undefined,
  saasId: string | undefined,
  imageUrls?: string[],
  imageSegments?: ReelsImageSegment[],
): Promise<ReelsConfig> {
  const durationSec = clamp(
    Math.round(config.durationSec || REELS_DEFAULTS.minDurationSec),
    REELS_DEFAULTS.minDurationSec,
    REELS_DEFAULTS.maxDurationSec,
  );

  // Sin `music` (D1/R2 no configurados en este entorno) el Reel se genera sin audio,
  // igual que cuando reel_music_tracks no tiene ninguna pista activa ni en fallback.
  const musicTrack = music ? await selectMusicTrack(config.template, music) : null;

  // Tema del Reel para el guion de narración — el título ya decidido (post-merge con la
  // IA) es el análogo más cercano a un "strategyItem.theme" en este agente, que no recibe
  // ninguno (eso es un concepto de ContentGeneratorAgent/CarouselComposerAgent, no de Reels).
  const tema = config.textOverlays.find((t) => t.role === "title")?.text?.trim() || niche;
  const narrationTrackUrl = await generateNarrationTrackUrl({ niche, tema, seasonalContext, tenantId, saasId });

  return {
    ...config,
    imageUrl,
    ...(imageUrls ? { imageUrls } : {}),
    ...(imageSegments ? { imageSegments } : {}),
    width: REELS_DEFAULTS.width,
    height: REELS_DEFAULTS.height,
    fps: clamp(Math.round(config.fps || REELS_DEFAULTS.fps), REELS_DEFAULTS.minFps, REELS_DEFAULTS.maxFps),
    durationSec,
    ...(musicTrack ? { musicTrackUrl: musicTrack.url } : {}),
    ...(narrationTrackUrl ? { narrationTrackUrl } : {}),
    // Forzado igual que imageUrl/width/height/fps — el handle de marca del cliente nunca
    // debe depender de lo que "invente" el modelo (mismo criterio que el resto de campos
    // no-IA de esta función).
    handle,
    effects: config.effects.map((e) => ({ ...e, startAt: clamp(e.startAt, 0, durationSec), endAt: clamp(e.endAt, 0, durationSec) })),
    textOverlays: config.textOverlays
      .filter((t) => t.text.trim().length > 0)
      .map((t) => ({ ...t, startAt: clamp(t.startAt, 0, durationSec), durationSec: clamp(t.durationSec, 0.5, durationSec) })),
  };
}

export class ReelsAgent {
  async run(input: {
    imageUrl: string;
    imageUrls?: string[];
    profile: BrandProfile;
    /** SOCIAL_DB + SOCIAL_MEDIA_R2_PUBLIC_URL — omitir genera el Reel sin audio. */
    music?: MusicTrackDeps;
    // Optional — habilita inyectar NicheIntelligence (hooks virales, hashtags reales,
    // temas trending) en el prompt de textOverlays, mismo patrón que
    // ContentGeneratorAgent/CarouselComposerAgent. Omitido por callers sin contexto de
    // tenant degrada al comportamiento de siempre, sin sección añadida.
    tenantId?: string;
    saasId?: string;
  }): Promise<ReelsConfig> {
    const { imageUrl, profile, music } = input;

    const dracoEnv = env();
    const [nicheIntel, styleHistory] = dracoEnv
      ? await Promise.all([
          getNicheIntelligence(profile.niche, dracoEnv, input.tenantId, input.saasId),
          input.tenantId && input.saasId
            ? getStyleHistory(input.tenantId, input.saasId, dracoEnv)
            : Promise.resolve([]),
        ])
      : [null, []];
    const trendSignals = extractTrendSignals(nicheIntel?.analysis);
    const topHookPatterns = styleHistory[0] ? parseTopHookPatterns(styleHistory[0].snapshotJson) : [];

    const nicheIntelSection = nicheIntel
      ? `\nINTELIGENCIA DEL NICHO ESTA SEMANA:\n${nicheIntel.hooks.length ? `- Hooks virales que funcionan: ${nicheIntel.hooks.join(" | ")}\n` : ""}${nicheIntel.hashtags.length ? `- Hashtags reales de tendencia: ${nicheIntel.hashtags.join(" ")}\n` : ""}${trendSignals?.redditTopics.length ? `- Temas trending en comunidades (Reddit): ${trendSignals.redditTopics.slice(0, 5).join(" | ")}\n` : ""}${trendSignals?.globalTrends.length ? `- Tendencias globales esta semana: ${trendSignals.globalTrends.slice(0, 5).join(", ")}\n` : ""}${topHookPatterns.length ? `- Patrones de hook que mejor funcionan con esta marca: ${topHookPatterns.join(", ")}\n` : ""}`
      : "";

    // profile.seasonalContext es el JSON completo que genera SeasonalityAgent
    // (context/hooks/themes/cta_suggestions/avoid) — se interpola tal cual, sin
    // desestructurar campo a campo: Mistral ya sabe leer JSON dentro de un prompt.
    const seasonalSection = profile.seasonalContext
      ? `\nCONTEXTO ESTACIONAL DEL MES (JSON):\n${profile.seasonalContext}\n`
      : "";

    // Base multi-imagen (PARTE 4): solo se activa con 2+ imágenes — con 0-1, es
    // exactamente el flujo de una sola imagen de siempre (nadie llama a run() con
    // imageUrls todavía; esto es la base del motor, no está conectado a la UI/API aún).
    const imageUrls = input.imageUrls && input.imageUrls.length >= 2 ? input.imageUrls : undefined;

    const template = pickTemplate(profile);
    const durationSec = TEMPLATE_DURATIONS[template];

    // Mismo criterio para tipografía/CTA que para los efectos: seed por imagen (o por el
    // conjunto de imágenes) — mismo Reel siempre sale igual, Reels de fotos distintas varían.
    const typographyRandom = seededRandom(imageUrls ? imageUrls.join("|") : imageUrl);

    const { effects, imageSegments } = imageUrls
      ? buildMultiImageEffects(template, durationSec, imageUrls)
      : { effects: buildChainedEffects(template, durationSec, seededRandom(imageUrl)), imageSegments: undefined };

    // Una sola vez para todo el clip (a diferencia de effects, que se decide por
    // segmento/imagen) — mismo stream que tipografía/CTA, así que el mismo Reel sigue
    // saliendo siempre igual. filmGrain/lightLeak son ortogonales a colorGrade (pools
    // independientes, se pueden combinar) — ver TEMPLATE_FILM_GRAIN_POOL/TEMPLATE_LIGHT_LEAK_POOL.
    const colorGrade = pickFrom(TEMPLATE_COLOR_GRADE_POOL[template], typographyRandom);
    const filmGrain = pickFrom(TEMPLATE_FILM_GRAIN_POOL[template], typographyRandom);
    const lightLeak = pickFrom(TEMPLATE_LIGHT_LEAK_POOL[template], typographyRandom);
    const animatedBackground = pickFrom(ANIMATED_BG_POOLS[template], typographyRandom);

    const base: ReelsConfig = {
      imageUrl,
      ...(imageUrls ? { imageUrls } : {}),
      ...(imageSegments ? { imageSegments } : {}),
      template,
      colorGrade,
      filmGrain,
      lightLeak,
      animatedBackground,
      effects,
      textOverlays: buildBaseTextOverlays(template, durationSec, profile, typographyRandom),
      durationSec,
      fps: REELS_DEFAULTS.fps,
      width: REELS_DEFAULTS.width,
      height: REELS_DEFAULTS.height,
    };

    const voiceSection = extractVoiceSection(profile.longDescription);

    const prompt = `Decide la configuración de un Reel (vídeo corto vertical) para una marca de "${profile.niche}" llamada "${profile.brandIdentity}".
Tono: ${profile.toneOfVoice}.
${voiceSection ? `\n${voiceSection}\n` : ""}${nicheIntelSection}${seasonalSection}
La plantilla debe ser exactamente una de: "fitness", "lifestyle", "motivation", "education", "marketing" — la que mejor encaje con el nicho.
Cada efecto debe ser uno de: "zoom-in", "zoom-out", "parallax", "rotate", "blur", "ken-burns", "drift", "pulse", "tilt", con startAt/endAt en segundos dentro de la duración del clip e intensity entre 0 y 1.
Los efectos ya están calculados y NO deben modificarse — preserva exactamente los valores de "effects" que recibes en el JSON base.
Cada texto animado (textOverlays) debe tener una frase corta y directa EN ESPAÑOL (máximo 6 palabras), relevante para "${profile.niche}" y la marca "${profile.brandIdentity}" — nunca genérica, EXCEPTO el overlay cuyo "role" es "cta": ese campo ya está seleccionado y NO debe modificarse — usa exactamente el valor que recibes en el JSON base. Si hay una sección de voz real arriba, que las frases suenen coherentes con esa voz dentro del límite de 6 palabras. Si hay inteligencia del nicho arriba, inspírate en esos hooks/temas trending para el título y subtítulo — sin copiarlos literalmente ni salirte del límite de 6 palabras.
La duración total (durationSec) debe estar entre ${REELS_DEFAULTS.minDurationSec} y ${REELS_DEFAULTS.maxDurationSec} segundos.`;

    // "effects"/"imageSegments"/"cta"/"colorGrade"/"filmGrain"/"lightLeak"/"animatedBackground"
    // nunca se sobrescriben con lo que devuelva la IA (ver mergeAiStructuredOutput en
    // localModel.ts) — ya están decididos por seed antes de esta llamada, precisamente
    // para que dos imágenes distintas den Reels distintos.
    const { data } = await defaultLocalModel.generateStructured<ReelsConfig>(
      { prompt, protectedKeys: ["effects", "imageSegments", "cta", "colorGrade", "filmGrain", "lightLeak", "animatedBackground"] },
      () => base,
    );

    return sanitizeConfig(
      data,
      imageUrl,
      music,
      profile.channelHandle,
      profile.niche,
      profile.seasonalContext,
      input.tenantId,
      input.saasId,
      imageUrls,
      imageSegments,
    );
  }
}
