import type { ReelsTemplate } from "./ReelsEngine";

// DEPRECATED (ver music-selector.ts) — pool fijo de 12 pistas que selectMusicTrack()
// usaba antes de conectar reel_music_tracks en SOCIAL_DB (D1). Se mantiene aquí sin
// borrar hasta confirmar en producción que la query D1 funciona con un Reel real.
// No se importa desde ningún otro archivo.

const MUSIC_BASE_URL = "https://pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev/music/";

export type MusicCategory = "fitness_energetic" | "lifestyle_chill" | "educativo_corporate" | "general_upbeat";

const TRACKS_PER_CATEGORY = 3;

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

export function selectMusicTrackFromStaticPool(template: ReelsTemplate, random: () => number = Math.random): string {
  const category = TEMPLATE_TO_CATEGORY[template];
  const index = 1 + Math.floor(random() * TRACKS_PER_CATEGORY);
  return buildTrackUrl(category, index);
}
