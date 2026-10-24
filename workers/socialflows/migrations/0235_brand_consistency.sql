-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — BrandConsistencyAgent: verifica que el contenido generado por IA
-- (saas_social_posts.creation_mode = 'AUTO') sigue siendo coherente con el perfil de
-- marca del cliente (tono, personalidad, nicho, misión/propuesta de valor + KB), y
-- alerta cuando el Cerebro empieza a generar contenido "fuera de personaje".
--
-- Tabla por TENANT, upsert por (tenant_id, saas_id) — mismo patrón que
-- socialcors_content_series / socialcors_seasonal_opportunities.
CREATE TABLE IF NOT EXISTS socialcors_brand_consistency (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  post_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_consistency_tenant_saas
  ON socialcors_brand_consistency(tenant_id, saas_id);
