-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — SeasonalOpportunityAgent: calendario hardcodeado de eventos
-- estacionales por nicho, con alertas de cuenta regresiva (21/14/7 días) en el
-- Intelligence Feed. Complementario a SeasonalityAgent (contexto mensual vía Mistral,
-- socialflow_seasonality_cache) — este agente trabaja con fechas exactas, no con meses.
--
-- Tabla por TENANT, upsert por (tenant_id, saas_id) — mismo patrón que
-- socialcors_content_series / socialcors_audience_growth (solo importa el snapshot
-- vigente, no historial).
CREATE TABLE IF NOT EXISTS socialcors_seasonal_opportunities (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seasonal_opportunities_tenant_saas
  ON socialcors_seasonal_opportunities(tenant_id, saas_id);
