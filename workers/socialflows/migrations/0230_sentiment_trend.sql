-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — SentimentTrendAgent: analiza la evolución del sentimiento en los
-- comentarios reales del tenant (socialflow_conversation_threads, thread_type='COMMENT')
-- y alerta en el Intelligence Feed si el ratio de negativos sube.
--
-- Tabla por TENANT, upsert por (tenant_id, saas_id) — mismo patrón que
-- socialcors_posting_schedule / socialcors_audience_growth (solo importa el snapshot
-- vigente, no historial).
CREATE TABLE IF NOT EXISTS socialcors_sentiment_trend (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sentiment_trend_tenant_saas
  ON socialcors_sentiment_trend(tenant_id, saas_id);
