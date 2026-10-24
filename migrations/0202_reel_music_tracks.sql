CREATE TABLE IF NOT EXISTS reel_music_tracks (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  r2_key        TEXT NOT NULL,
  niche         TEXT NOT NULL,
  mood          TEXT,
  bpm           INTEGER,
  duration_seconds INTEGER NOT NULL,
  source        TEXT NOT NULL DEFAULT 'pixabay',
  source_url    TEXT,
  license       TEXT NOT NULL DEFAULT 'pixabay_content_license',
  active        INTEGER NOT NULL DEFAULT 1,
  weight        INTEGER NOT NULL DEFAULT 1,
  play_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reel_music_niche_active ON reel_music_tracks(niche, active);
CREATE INDEX IF NOT EXISTS idx_reel_music_playcount ON reel_music_tracks(niche, play_count);
