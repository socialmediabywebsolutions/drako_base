-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — InfluencerBenchmarkAgent: top 3 canales de YouTube más vistos
-- por nicho (YouTube Data API, ya usada por TrendKeywordAgent) + insight de Mistral
-- sobre qué patrones los hacen virales. Solo relevante para accountType="influencer"
-- (el filtro se aplica al leer desde el chat, no aquí) — keyed por niche únicamente,
-- una fila por nicho, refrescada semanalmente junto a socialcors_niche_intelligence.
CREATE TABLE IF NOT EXISTS socialcors_influencer_benchmarks (
  id            TEXT PRIMARY KEY,
  niche         TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  valid_until   TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_influencer_benchmarks_niche
  ON socialcors_influencer_benchmarks(niche);
