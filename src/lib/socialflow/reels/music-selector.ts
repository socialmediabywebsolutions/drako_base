import type { ReelsTemplate } from "./ReelsEngine";

// Capa 2 (soporte) — elige una pista de música de fondo para un Reel a partir de su
// plantilla, consultando reel_music_tracks en SOCIAL_DB (D1). Reemplaza el pool fijo
// de 12 URLs estáticas (ver _deprecated.mp3-pool.ts) por música real curada por nicho.

export type MusicTrack = {
  id: string;
  name: string;
  url: string;
  durationSeconds: number;
  bpm: number | null;
  mood: string | null;
};

export type MusicTrackDeps = {
  db: D1Database;
  r2PublicUrl: string;
};

// niche sin curar todavía (nicho nuevo) cae aquí — es el que más pistas "genéricas" tiene.
const FALLBACK_NICHE: ReelsTemplate = "lifestyle";

const CANDIDATE_LIMIT = 5;

type MusicTrackRow = {
  id: string;
  name: string;
  r2_key: string;
  duration_seconds: number;
  bpm: number | null;
  mood: string | null;
};

async function fetchCandidates(db: D1Database, niche: ReelsTemplate): Promise<MusicTrackRow[]> {
  const result = await db
    .prepare(
      `SELECT id, name, r2_key, duration_seconds, bpm, mood
       FROM reel_music_tracks
       WHERE niche = ? AND active = 1
       ORDER BY play_count ASC, RANDOM()
       LIMIT ?`,
    )
    .bind(niche, CANDIDATE_LIMIT)
    .all<MusicTrackRow>();
  return result.results ?? [];
}

async function incrementPlayCount(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(`UPDATE reel_music_tracks SET play_count = play_count + 1, updated_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();
}

function toMusicTrack(row: MusicTrackRow, r2PublicUrl: string): MusicTrack {
  return {
    id: row.id,
    name: row.name,
    url: `${r2PublicUrl.replace(/\/$/, "")}/${row.r2_key}`,
    durationSeconds: row.duration_seconds,
    bpm: row.bpm,
    mood: row.mood,
  };
}

/**
 * Elige una pista de música para el template dado desde reel_music_tracks (SOCIAL_DB).
 * `random` es inyectable para tests deterministas (por defecto Math.random).
 * Devuelve null si no hay ninguna pista activa ni siquiera en el fallback "lifestyle"
 * (Reel se genera sin audio — ver ReelsConfig.musicTrackUrl).
 */
export async function selectMusicTrack(
  template: ReelsTemplate,
  { db, r2PublicUrl }: MusicTrackDeps,
  random: () => number = Math.random,
): Promise<MusicTrack | null> {
  let candidates = await fetchCandidates(db, template);
  if (candidates.length === 0 && template !== FALLBACK_NICHE) {
    candidates = await fetchCandidates(db, FALLBACK_NICHE);
  }
  if (candidates.length === 0) {
    return null;
  }

  const chosen = candidates[Math.floor(random() * candidates.length)];
  await incrementPlayCount(db, chosen.id);

  return toMusicTrack(chosen, r2PublicUrl);
}
