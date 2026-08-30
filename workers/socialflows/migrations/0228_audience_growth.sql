-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — AudienceGrowthAgent: clasifica los posts del tenant en "atraen
-- audiencia nueva" (reach alto relativo a likes) vs. "fidelizan audiencia existente"
-- (saved+comments por encima de la media), y extrae patrones (formato/hook/hora) para
-- cada categoría vía Mistral.
--
-- Tabla por TENANT, upsert por (tenant_id, saas_id) — mismo patrón que
-- socialcors_hashtag_intelligence (solo importa la clasificación vigente, no historial).
-- No usa socialflow_social_metrics_snapshots.followers_count como fuente: esa tabla
-- tiene UNIQUE (tenant_id, saas_id, provider), así que nunca puede haber más de un
-- snapshot — no existe historial de seguidores real que leer. La clasificación se basa
-- enteramente en métricas por post (reach/likes/saved/comments).
CREATE TABLE IF NOT EXISTS socialcors_audience_growth (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  post_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audience_growth_tenant_saas
  ON socialcors_audience_growth(tenant_id, saas_id);
