-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — StrategicPlanningAgent: sintetiza los snapshots de TODOS los
-- agentes del Cerebro para un tenant en un plan mensual cohesionado (1 sola llamada a
-- Mistral semanal). Se muestra como tarjeta fija en la pestaña Inteligencia del CRM
-- Social, fuera del scroll del Intelligence Feed.
--
-- Tabla por TENANT, upsert por (tenant_id, saas_id) — mismo patrón que
-- socialcors_content_series / socialcors_seasonal_opportunities.
CREATE TABLE IF NOT EXISTS socialcors_strategic_plan (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_strategic_plan_tenant_saas
  ON socialcors_strategic_plan(tenant_id, saas_id);
