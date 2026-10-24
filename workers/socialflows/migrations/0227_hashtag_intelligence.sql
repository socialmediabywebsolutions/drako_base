-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — HashtagIntelligenceAgent: analiza los hashtags reales usados en
-- los últimos posts del tenant (frecuencia, sobreuso >60%) y los cruza con tendencias
-- reales del nicho (socialcors_niche_intelligence) para recomendar un mix de 15-20
-- hashtags en 3 grupos (nicho/tendencia/alcance).
--
-- Tabla por TENANT (a diferencia de socialcors_niche_intelligence/
-- socialcors_influencer_benchmarks, que son por nicho) — una sola fila vigente por
-- tenant, actualizada cada día por el cron de style-learning (upsert, no historial: a
-- diferencia de socialcors_performance_snapshots, aquí solo importa el mix vigente).
CREATE TABLE IF NOT EXISTS socialcors_hashtag_intelligence (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  post_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hashtag_intelligence_tenant_saas
  ON socialcors_hashtag_intelligence(tenant_id, saas_id);
