-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — BestPracticesAgent: identifica los TOP 3 tenants con mayor
-- engagement compuesto dentro del mismo nicho+accountType del cliente (a partir de
-- snapshots ya persistidos por ContentPerformanceAgent), agrega sus patrones de forma
-- anónima, y los compara contra el historial propio del cliente. El snapshot_json
-- nunca contiene tenant_id/saas_id de otro tenant, solo agregados numéricos.
--
-- Tabla por TENANT, upsert por (tenant_id, saas_id) — mismo patrón que
-- socialcors_revenue_opportunities / socialcors_churn_predictions.
CREATE TABLE IF NOT EXISTS socialcors_best_practices (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_best_practices_tenant_saas
  ON socialcors_best_practices(tenant_id, saas_id);
