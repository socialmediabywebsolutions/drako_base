-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — ContentDiversityAgent: detecta cuando el cliente lleva demasiado
-- tiempo publicando el mismo tipo de contenido (formato o tema) y alimenta esa señal al
-- pipeline de generación (StrategyAgent) y al chat. Complementario a ContentFatigueAgent
-- (racha ininterrumpida, ya escribe en Intelligence Feed) — este agente mide RATIO sobre
-- una ventana, no racha, y no escribe en el feed (evita duplicar esa alerta).
--
-- Tabla por TENANT, upsert por (tenant_id, saas_id) — mismo patrón que
-- socialcors_content_series / socialcors_brand_consistency.
CREATE TABLE IF NOT EXISTS socialcors_content_diversity (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  post_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_diversity_tenant_saas
  ON socialcors_content_diversity(tenant_id, saas_id);
