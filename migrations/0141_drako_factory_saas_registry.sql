CREATE TABLE IF NOT EXISTS drako_factory_saas_registry (
  saas_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  template TEXT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','DISABLED','DEGRADED','ARCHIVED')),
  created_by TEXT,
  supports_operator_surface INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drako_factory_saas_registry_status
ON drako_factory_saas_registry(status, updated_at DESC);
