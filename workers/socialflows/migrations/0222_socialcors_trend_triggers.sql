-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — Nivel 3 (flujo autónomo tendencia → imagen+texto → publicado,
-- solo tenant interno). Traza cada disparo del conector de scoring de trendSignals
-- (TrendKeywordAgent) hacia una campaña encolada en SOCIALFLOW_AI_QUEUE, y su
-- resolución posterior (auto-aprobado, vetado por humano, o generación fallida).
-- trend_snapshot_json congela el trendSignals evaluado en el momento del disparo,
-- porque TrendKeywordAgent sobreescribe analysis_json.trendSignals en su siguiente
-- corrida sobre ese mismo nicho — sin esta copia se perdería la trazabilidad de qué
-- señal concreta causó cada post.
CREATE TABLE IF NOT EXISTS socialcors_trend_triggers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  niche TEXT NOT NULL,
  trend_score REAL NOT NULL,
  score_breakdown_json TEXT NOT NULL,
  trend_fetched_at TEXT NOT NULL,
  trend_snapshot_json TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'TRIGGERED',
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_trend_triggers_tenant_status
  ON socialcors_trend_triggers (tenant_id, status);

-- Idempotencia: si el conector corriera dos veces sobre el mismo snapshot (reintento
-- de Cloudflare, condición de carrera con el watermark), el segundo INSERT falla por
-- este constraint en vez de disparar una segunda generación para la misma tendencia.
CREATE UNIQUE INDEX IF NOT EXISTS idx_trend_triggers_dedupe
  ON socialcors_trend_triggers (tenant_id, niche, trend_fetched_at);
