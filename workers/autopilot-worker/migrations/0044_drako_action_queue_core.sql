CREATE TABLE IF NOT EXISTS campamento_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT,
  category TEXT NOT NULL,
  priority TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT,
  snoozed_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_campamento_actions_status
  ON campamento_actions (tenant_id, status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_campamento_actions_saas
  ON campamento_actions (tenant_id, saas_id, status);
