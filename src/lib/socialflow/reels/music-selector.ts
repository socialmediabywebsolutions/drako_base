import type { ReelsTemplate } from "./ReelsEngine";

// Capa 2 (soporte) — elige una pista de música de fondo para un Reel a partir de su
// plantilla. Las pistas viven públicamente en R2, organizadas por categoría (3 variantes
// cada una) para poder rotar sin repetir siempre la misma en un mismo nicho.

const MUSIC_BASE_URL = "https://pub-04c730a67921499bac35a1f62402cc17.r2.dev/music/";

export type MusicCategory = "fitness_energetic" | "lifestyle_chill" | "educativo_corporate" | "general_upbeat";

const TRACKS_PER_CATEGORY = 3;

// motivation no tiene categoría propia: encaja con el ritmo enérgico de fitness.
// marketing tampoco: no es ni deportivo ni educativo, así que usa el fondo genérico.
const TEMPLATE_TO_CATEGORY: Record<ReelsTemplate, MusicCategory> = {
  fitness: "fitness_energetic",
  motivation: "fitness_energetic",
  lifestyle: "lifestyle_chill",
  education: "educativo_corporate",
  marketing: "general_upbeat",
};

function buildTrackUrl(category: MusicCategory, index: number): string {
  return `${MUSIC_BASE_URL}${category}_${index}.mp3`;
}

/**
 * Elige una pista de música para el template dado. `random` es inyectable para tests
 * deterministas (por defecto Math.random).
 */
export function selectMusicTrack(template: ReelsTemplate, random: () => number = Math.random): string {
  const category = TEMPLATE_TO_CATEGORY[template];
  const index = 1 + Math.floor(random() * TRACKS_PER_CATEGORY);
  return buildTrackUrl(category, index);
}
