-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — RevenueOpportunityAgent: cruza AudienceGrowthAgent +
-- SeasonalOpportunityAgent + SentimentTrendAgent para detectar el momento ideal en que
-- un cliente empresa debería lanzar una promoción. Solo aplica a accountType="empresa".
--
-- Tabla por TENANT, upsert por (tenant_id, saas_id) — mismo patrón que
-- socialcors_churn_predictions / socialcors_strategic_plan.
CREATE TABLE IF NOT EXISTS socialcors_revenue_opportunities (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_opportunities_tenant_saas
  ON socialcors_revenue_opportunities(tenant_id, saas_id);
