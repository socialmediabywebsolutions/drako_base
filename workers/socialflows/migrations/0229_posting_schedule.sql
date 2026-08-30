-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — OptimalPostingScheduleAgent: aprende el RITMO óptimo de
-- publicación por tenant (día de la semana, separación entre posts, orden de formatos),
-- complementario a BestTimeToPostAgent (que calcula la HORA óptima por formato).
--
-- Tabla por TENANT, upsert por (tenant_id, saas_id) — mismo patrón que
-- socialcors_hashtag_intelligence / socialcors_audience_growth (solo importa el
-- snapshot vigente, no historial). Nunca se escribe en socialcors_style_history, que
-- StyleLearningAgent y detectContentFatigue tratan como snapshots homogéneos.
CREATE TABLE IF NOT EXISTS socialcors_posting_schedule (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  post_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_posting_schedule_tenant_saas
  ON socialcors_posting_schedule(tenant_id, saas_id);
