-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — ViralMomentAgent: detecta temas que están subiendo rápido en el
-- nicho (cruzando youtubeHooks/redditTopics/globalTrends de TrendKeywordAgent) y alerta
-- al cliente antes de que sean mainstream.
--
-- socialcors_niche_intelligence.analysis_json.trendSignals se sobrescribe en el sitio en
-- cada refresco (ver TrendKeywordAgent.processNiche) — no guarda historial. Esta tabla es
-- el tracking propio que permite calcular "cuánto lleva subiendo un tema" de verdad, en
-- vez de comparar contra un snapshot de hace 7 días que no existe.
CREATE TABLE IF NOT EXISTS socialcors_viral_topic_tracking (
  id            TEXT PRIMARY KEY,
  niche         TEXT NOT NULL,
  account_type  TEXT NOT NULL,
  topic         TEXT NOT NULL,
  topic_label   TEXT NOT NULL,
  sources_json  TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_viral_topic_tracking_key
  ON socialcors_viral_topic_tracking(niche, account_type, topic);

-- Snapshot de salida por TENANT, upsert por (tenant_id, saas_id) — mismo patrón que
-- socialcors_sentiment_trend / socialcors_posting_schedule (solo importa el snapshot
-- vigente, lo consume el chat vía getLatestViralMoments).
CREATE TABLE IF NOT EXISTS socialcors_viral_moments (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_viral_moments_tenant_saas
  ON socialcors_viral_moments(tenant_id, saas_id);
