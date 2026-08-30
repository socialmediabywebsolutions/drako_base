-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — ChurnPredictionAgent: detecta señales de inactividad/abandono
-- por tenant (sin publicar, sin login, alto rechazo de posts, drafts abandonados) y
-- calcula un churn risk score. Visible SOLO en el panel operador de Drako (vía
-- getLatestChurnPrediction/API interna) — nunca en el Intelligence Feed del cliente.
--
-- Tabla por TENANT, upsert por (tenant_id, saas_id) — mismo patrón que
-- socialcors_content_diversity / socialcors_brand_consistency.
CREATE TABLE IF NOT EXISTS socialcors_churn_predictions (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_churn_predictions_tenant_saas
  ON socialcors_churn_predictions(tenant_id, saas_id);
