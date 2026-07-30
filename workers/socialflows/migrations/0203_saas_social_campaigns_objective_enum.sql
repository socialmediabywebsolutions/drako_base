-- Reemplaza el objective TEXT NOT NULL (texto libre, legacy) por un enum estructurado
-- de objetivo de campaña: null = sin override, hereda clientObjective del perfil del
-- cliente. SQLite no soporta ALTER COLUMN para quitar NOT NULL, así que se reconstruye
-- la tabla completa preservando el resto de columnas (incl. post_count/reel_count/
-- historia_count de 0200, carousel_count de 0201) e índices.

CREATE TABLE saas_social_campaigns_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  name TEXT NOT NULL,
  objective TEXT CHECK (objective IS NULL OR objective IN ('followers','engagement','leads','sales','saves','virality')),
  status TEXT NOT NULL,
  target_segment TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  budget_estimate REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  post_count INTEGER NOT NULL DEFAULT 0,
  reel_count INTEGER NOT NULL DEFAULT 0,
  historia_count INTEGER NOT NULL DEFAULT 0,
  carousel_count INTEGER NOT NULL DEFAULT 0
);

-- Los valores libres existentes que no son uno de los 6 objetivos válidos se descartan
-- a NULL (pierden la descripción, no la campaña) — no hay forma de mapear "AWARENESS"
-- u otro texto libre a un objetivo real sin intervención manual.
INSERT INTO saas_social_campaigns_new
SELECT id, tenant_id, saas_id, name,
  CASE WHEN objective IN ('followers','engagement','leads','sales','saves','virality') THEN objective ELSE NULL END,
  status, target_segment, start_date, end_date, budget_estimate, notes, created_at, updated_at,
  post_count, reel_count, historia_count, carousel_count
FROM saas_social_campaigns;

DROP TABLE saas_social_campaigns;
ALTER TABLE saas_social_campaigns_new RENAME TO saas_social_campaigns;

CREATE INDEX IF NOT EXISTS idx_saas_social_campaigns_tenant
  ON saas_social_campaigns (tenant_id, saas_id);

CREATE INDEX IF NOT EXISTS idx_saas_social_campaigns_status
  ON saas_social_campaigns (saas_id, status);

CREATE INDEX IF NOT EXISTS idx_runtime_social_campaigns_workspace
  ON saas_social_campaigns (tenant_id, saas_id, status);
