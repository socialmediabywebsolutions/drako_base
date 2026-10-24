-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — ContentSeriesAgent: detecta posts con momentum (últimos 14 días)
-- y sugiere series de posts de seguimiento para aprovechar el impulso.
--
-- Tabla por TENANT, upsert por (tenant_id, saas_id) — mismo patrón que
-- socialcors_audience_growth / socialcors_posting_schedule (solo importa el snapshot
-- vigente, no historial).
CREATE TABLE IF NOT EXISTS socialcors_content_series (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  post_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_series_tenant_saas
  ON socialcors_content_series(tenant_id, saas_id);
