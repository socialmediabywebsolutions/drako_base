-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — ContentPerformanceAgent: análisis de los propios posts del
-- tenant (top 3 por engagement compuesto: saved×3 + comments×2 + likes + shares) +
-- insight de por qué funcionaron, generado por Mistral.
--
-- Tabla PROPIA, deliberadamente separada de socialcors_style_history (0207) — esa
-- tabla no tiene columna de tipo, y detectContentFatigue() (NicheIntelligenceService.ts)
-- asume que las últimas 3 filas son siempre snapshots de StyleLearningAgent
-- (lee topHookPatterns[0] de cada una). Meter un snapshot de otro tipo ahí rompería esa
-- detección de fatiga ya conectada al chat. Mismo esquema/patrón que
-- socialcors_style_history (INSERT + poda a las N más recientes por tenant), solo que
-- en su propia tabla.
CREATE TABLE IF NOT EXISTS socialcors_performance_snapshots (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  post_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_socialcors_performance_snapshots_tenant_created
  ON socialcors_performance_snapshots (tenant_id, saas_id, created_at DESC);
