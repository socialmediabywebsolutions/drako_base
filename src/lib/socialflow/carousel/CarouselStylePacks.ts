// Sistema de estilos visuales por nicho para carruseles — cada pack tiene 4 variantes
// (A/B/C/D) que rotan de forma determinista entre carruseles sucesivos del mismo
// cliente (getStyleForCarousel), nunca al azar: mismo criterio que ya se usa en
// ReelsAgent.ts para plantillas por nicho, pero con rotación en vez de selección fija.
//
// Base de la Fase 1 (motor de estilos) — todavía sin conectar a ningún caller
// (publish-carrusel.tsx / CarouselComposerAgent.ts siguen sin usar `style`/`handle`).

export type CarouselNichePackKey = "fitness" | "psicologia" | "educacion" | "food";

export type CarouselStyleVariantKey = "A" | "B" | "C" | "D";

export type CarouselBackgroundKind = "solid" | "gradient" | "stripes";

export type CarouselStyleVariant = {
  key: CarouselStyleVariantKey;
  label: string;
  fontFamily: string;
  fontWeight: number;
  textColor: string;
  /** Color de la última palabra cuando highlightLastWord es true (Estilo B). */
  accentColor?: string;
  /** Técnica de fondo generado — solo se usa cuando el slide no trae foto (modo "Crear con IA"). */
  backgroundKind: CarouselBackgroundKind;
  /** 1 color para "solid"/"stripes" (base + raya), 2 para "gradient". */
  backgroundColors: [string, string?];
  /** Estilo B: la frase completa ya usa fontFamily cursiva; esto solo recolorea la última palabra. */
  highlightLastWord?: boolean;
  /** Estilo C: fondo oscurecido + texto blanco forzado, incluso sobre una foto real. */
  darkOverlay?: boolean;
  /** Estilo D: texto más pequeño que el tamaño base por rol (TEXT_ROLE_STYLE). */
  fontScale?: number;
};

export type CarouselStylePack = {
  key: CarouselNichePackKey;
  label: string;
  variants: [CarouselStyleVariant, CarouselStyleVariant, CarouselStyleVariant, CarouselStyleVariant];
};

// ── Fitness/Wellness — colores tierra, bold sans-serif + script cursiva ───────────────
const FITNESS_PACK: CarouselStylePack = {
  key: "fitness",
  label: "Fitness / Wellness",
  variants: [
    {
      key: "A",
      label: "Bold + fondo sólido",
      fontFamily: "'Arial Black', 'Helvetica Neue', sans-serif",
      fontWeight: 900,
      textColor: "#161412",
      backgroundKind: "stripes", // representa "rayas suaves" del pack
      backgroundColors: ["#E7DCC8", "#D8C9AC"],
    },
    {
      key: "B",
      label: "Cursiva con highlight",
      fontFamily: "'Brush Script MT', cursive",
      fontWeight: 400,
      textColor: "#161412",
      accentColor: "#B5602F",
      backgroundKind: "solid",
      backgroundColors: ["#FAF8F4"],
      highlightLastWord: true,
    },
    {
      key: "C",
      label: "Impacto oscuro",
      fontFamily: "'Arial Black', 'Helvetica Neue', sans-serif",
      fontWeight: 900,
      textColor: "#ffffff",
      backgroundKind: "solid",
      backgroundColors: ["#161412"],
      darkOverlay: true,
    },
    {
      key: "D",
      label: "Minimalista",
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      fontWeight: 700,
      textColor: "#161412",
      backgroundKind: "solid",
      backgroundColors: ["#FAF8F4"],
      fontScale: 0.7,
    },
  ],
};

// ── Psicología/Autoestima — tonos suaves, serif elegante + cursiva fina ───────────────
const PSICOLOGIA_PACK: CarouselStylePack = {
  key: "psicologia",
  label: "Psicología / Autoestima",
  variants: [
    {
      key: "A",
      label: "Bold + fondo sólido",
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontWeight: 700,
      textColor: "#3B3446",
      backgroundKind: "solid",
      backgroundColors: ["#D9CFEA"],
    },
    {
      key: "B",
      label: "Cursiva con highlight",
      fontFamily: "'Segoe Script', cursive",
      fontWeight: 400,
      textColor: "#3B3446",
      accentColor: "#8E6C9E",
      backgroundKind: "gradient", // representa "degradados suaves / formas orgánicas"
      backgroundColors: ["#F6F1E7", "#D9CFEA"],
      highlightLastWord: true,
    },
    {
      key: "C",
      label: "Impacto oscuro",
      fontFamily: "Georgia, serif",
      fontWeight: 700,
      textColor: "#ffffff",
      backgroundKind: "solid",
      backgroundColors: ["#3B3446"],
      darkOverlay: true,
    },
    {
      key: "D",
      label: "Minimalista",
      fontFamily: "Georgia, serif",
      fontWeight: 500,
      textColor: "#3B3446",
      backgroundKind: "solid",
      backgroundColors: ["#F6F1E7"],
      fontScale: 0.7,
    },
  ],
};

// ── Educación — colores vibrantes, bold + iconos simples ──────────────────────────────
const EDUCACION_PACK: CarouselStylePack = {
  key: "educacion",
  label: "Educación",
  variants: [
    {
      key: "A",
      label: "Bold + fondo sólido",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontWeight: 800,
      textColor: "#ffffff",
      backgroundKind: "solid",
      backgroundColors: ["#2563EB"],
    },
    {
      key: "B",
      label: "Cursiva con highlight",
      fontFamily: "'Brush Script MT', cursive",
      fontWeight: 400,
      textColor: "#ffffff",
      accentColor: "#111827",
      backgroundKind: "solid",
      backgroundColors: ["#F97316"],
      highlightLastWord: true,
    },
    {
      key: "C",
      label: "Impacto oscuro",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontWeight: 800,
      textColor: "#ffffff",
      backgroundKind: "solid",
      backgroundColors: ["#111827"],
      darkOverlay: true,
    },
    {
      key: "D",
      label: "Minimalista",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontWeight: 700,
      textColor: "#2563EB",
      backgroundKind: "solid",
      backgroundColors: ["#FFFFFF"],
      fontScale: 0.7,
    },
  ],
};

// ── Food/Restaurante — tonos cálidos, serif elegante, foto protagonista ───────────────
const FOOD_PACK: CarouselStylePack = {
  key: "food",
  label: "Food / Restaurante",
  variants: [
    {
      key: "A",
      label: "Bold + fondo sólido",
      fontFamily: "Georgia, 'Playfair Display', serif",
      fontWeight: 700,
      textColor: "#F3E5D8",
      backgroundKind: "solid",
      backgroundColors: ["#C1502E"],
    },
    {
      key: "B",
      label: "Cursiva con highlight",
      fontFamily: "'Brush Script MT', cursive",
      fontWeight: 400,
      textColor: "#5C2E1A",
      accentColor: "#C1502E",
      backgroundKind: "gradient",
      backgroundColors: ["#F3E5D8", "#D4A017"],
      highlightLastWord: true,
    },
    {
      key: "C",
      label: "Impacto oscuro",
      fontFamily: "Georgia, serif",
      fontWeight: 700,
      textColor: "#ffffff",
      backgroundKind: "solid",
      backgroundColors: ["#5C2E1A"],
      darkOverlay: true,
    },
    {
      key: "D",
      label: "Minimalista",
      fontFamily: "Georgia, serif",
      fontWeight: 500,
      textColor: "#5C2E1A",
      backgroundKind: "solid",
      backgroundColors: ["#F3E5D8"],
      fontScale: 0.7,
    },
  ],
};

export const CAROUSEL_STYLE_PACKS: Record<CarouselNichePackKey, CarouselStylePack> = {
  fitness: FITNESS_PACK,
  psicologia: PSICOLOGIA_PACK,
  educacion: EDUCACION_PACK,
  food: FOOD_PACK,
};

const FITNESS_RE = /fitness|gym|entrenamiento|ejercicio|pesas|crossfit|yoga|pilates|nutrici[oó]n|bienestar f[ií]sico|wellness|deporte/i;
const PSICOLOGIA_RE = /psicolog|autoestima|terapia|salud mental|mindset|desarrollo personal|coaching emocional|bienestar emocional|ansiedad/i;
const FOOD_RE = /restaurante|gastronom|comida|cocina|chef|men[uú]|reposter[ií]a|panader[ií]a|cafeter[ií]a|food/i;
const EDUCACION_RE = /curso|academia|formaci[oó]n|aprende|tutorial|clase|coaching|mentor[ií]a|ense[ñn]|educaci[oó]n/i;

// Sin match → "educacion": el más neutro/general de los 4 (vibrante pero sin conexión
// temática específica), igual que ReelsAgent.ts usa "lifestyle" como catch-all.
export function getNichoPackKey(niche: string): CarouselNichePackKey {
  if (FITNESS_RE.test(niche)) return "fitness";
  if (PSICOLOGIA_RE.test(niche)) return "psicologia";
  if (FOOD_RE.test(niche)) return "food";
  if (EDUCACION_RE.test(niche)) return "educacion";
  return "educacion";
}

// Rotación determinista — carouselIndex % 4, nunca Math.random(). Mismo carouselIndex +
// mismo nicho siempre da el mismo estilo; carruseles consecutivos del mismo cliente
// rotan A→B→C→D→A... sin repetir hasta agotar las 4 variantes del pack.
export function getStyleForCarousel(niche: string, carouselIndex: number): CarouselStyleVariant {
  const pack = CAROUSEL_STYLE_PACKS[getNichoPackKey(niche)];
  const safeIndex = ((carouselIndex % pack.variants.length) + pack.variants.length) % pack.variants.length;
  return pack.variants[safeIndex];
}
