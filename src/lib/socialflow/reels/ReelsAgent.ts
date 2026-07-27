import { defaultLocalModel } from "../ai/models/localModel";
import type { BrandProfile } from "../ai/types";
import {
  REELS_DEFAULTS,
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

// Hash simple (djb2-like) de un string → entero 32-bit, usado para sembrar mulberry32.
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// PRNG mulberry32 — determinista dado un seed, buena distribución para nuestro caso
// (elegir entre 2-4 opciones repetidamente), sin dependencias externas. Mismo seed
// (ej. la URL de la imagen) siempre produce la misma secuencia de números: mismo Reel
// siempre sale igual (efectos + tipografía), distinto entre imágenes distintas.
export function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
const TEMPLATE_EFFECT_PROFILE: Record<ReelsTemplate, EffectProfile> = {
  fitness: { pool: ["pan", "zoom-in", "rotate", "ken-burns", "pulse"], segmentCount: [3, 4], segmentDurationSec: [2, 4], intensityRange: [0.3, 0.5] },
  motivation: { pool: ["zoom-in", "pan", "parallax", "ken-burns", "drift", "tilt"], segmentCount: [3, 4], segmentDurationSec: [2, 4], intensityRange: [0.3, 0.5] },
  lifestyle: { pool: ["parallax", "zoom-out", "pan", "ken-burns", "drift", "pulse"], segmentCount: [2, 3], segmentDurationSec: [4, 7], intensityRange: [0.15, 0.3] },
  // Ampliado de 4 a 6 tipos (pan/tilt tomados de motivation/marketing) — el intensityRange
  // bajo (0.1-0.2) de esta plantilla ya mantiene el movimiento sutil sin importar qué tipo
  // de efecto le toque, así que sumar más variedad no la vuelve "energética", solo evita
  // que sea siempre la misma combinación de 4.
  education: { pool: ["zoom-in", "parallax", "drift", "ken-burns", "pan", "tilt"], segmentCount: [2, 3], segmentDurationSec: [5, 9], intensityRange: [0.1, 0.2] },
  marketing: { pool: ["zoom-in", "rotate", "pan", "ken-burns", "tilt", "drift"], segmentCount: [2, 3], segmentDurationSec: [4, 6], intensityRange: [0.15, 0.3] },
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

// Re-acota lo que devuelva la IA a los límites reales del engine, y fuerza de vuelta
// imageUrl/imageUrls/imageSegments/width/height — nunca deben depender de lo que
// "invente" el modelo (mergeAiStructuredOutput deja que la IA reemplace arrays de
// strings como imageUrls si los incluye en su respuesta — ver localModel.ts).
async function sanitizeConfig(
  config: ReelsConfig,
  imageUrl: string,
  music: MusicTrackDeps | undefined,
  handle: string,
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
  }): Promise<ReelsConfig> {
    const { imageUrl, profile, music } = input;
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
    // saliendo siempre igual.
    const colorGrade = pickFrom(TEMPLATE_COLOR_GRADE_POOL[template], typographyRandom);

    const base: ReelsConfig = {
      imageUrl,
      ...(imageUrls ? { imageUrls } : {}),
      ...(imageSegments ? { imageSegments } : {}),
      template,
      colorGrade,
      effects,
      textOverlays: buildBaseTextOverlays(template, durationSec, profile, typographyRandom),
      durationSec,
      fps: REELS_DEFAULTS.fps,
      width: REELS_DEFAULTS.width,
      height: REELS_DEFAULTS.height,
    };

    const prompt = `Decide la configuración de un Reel (vídeo corto vertical) para una marca de "${profile.niche}" llamada "${profile.brandIdentity}".
Tono: ${profile.toneOfVoice}.

La plantilla debe ser exactamente una de: "fitness", "lifestyle", "motivation", "education", "marketing" — la que mejor encaje con el nicho.
Cada efecto debe ser uno de: "zoom-in", "zoom-out", "pan-left", "pan-right", "parallax", "rotate", "blur", "ken-burns", "drift", "pulse", "tilt", con startAt/endAt en segundos dentro de la duración del clip e intensity entre 0 y 1.
Los efectos ya están calculados y NO deben modificarse — preserva exactamente los valores de "effects" que recibes en el JSON base.
Cada texto animado (textOverlays) debe tener una frase corta y directa EN ESPAÑOL (máximo 6 palabras), relevante para "${profile.niche}" y la marca "${profile.brandIdentity}" — nunca genérica, EXCEPTO el overlay cuyo "role" es "cta": ese campo ya está seleccionado y NO debe modificarse — usa exactamente el valor que recibes en el JSON base.
La duración total (durationSec) debe estar entre ${REELS_DEFAULTS.minDurationSec} y ${REELS_DEFAULTS.maxDurationSec} segundos.`;

    // "effects"/"imageSegments"/"cta"/"colorGrade" nunca se sobrescriben con lo que
    // devuelva la IA (ver mergeAiStructuredOutput en localModel.ts) — ya están decididos
    // por seed antes de esta llamada, precisamente para que dos imágenes distintas den
    // Reels distintos.
    const { data } = await defaultLocalModel.generateStructured<ReelsConfig>(
      { prompt, protectedKeys: ["effects", "imageSegments", "cta", "colorGrade"] },
      () => base,
    );

    return sanitizeConfig(data, imageUrl, music, profile.channelHandle, imageUrls, imageSegments);
  }
}
