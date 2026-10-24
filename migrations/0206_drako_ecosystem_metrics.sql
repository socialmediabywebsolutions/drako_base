-- Métricas sociales del ecosistema Drako (DRACO_DB). Solo CREATE ... IF NOT EXISTS:
-- re-ejecutable, lo aplica el paso "Apply global schema additions on DRACO_DB" del deploy.
-- Una fila por saas_id + platform + ejecución del cron; se lee la más reciente.
-- source = 'live' (API de Meta/LinkedIn) | 'mock' (sin token o sin cuenta activa).
CREATE TABLE IF NOT EXISTS drako_ecosystem_metrics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  saas_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  followers INTEGER NOT NULL DEFAULT 0,
  posts INTEGER NOT NULL DEFAULT 0,
  engagement_rate REAL NOT NULL DEFAULT 0,
  reach_7d INTEGER NOT NULL DEFAULT 0,
  impressions_7d INTEGER NOT NULL DEFAULT 0,
  profile_url TEXT,
  username TEXT,
  source TEXT NOT NULL DEFAULT 'live',
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ecosystem_metrics_saas ON drako_ecosystem_metrics(saas_id, platform, fetched_at DESC);
