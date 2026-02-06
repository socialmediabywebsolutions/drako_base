CREATE TABLE IF NOT EXISTS saas_features (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  phase_order INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, saas_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_saas_features_status
  ON saas_features (tenant_id, saas_id, status);

CREATE INDEX IF NOT EXISTS idx_saas_features_category
  ON saas_features (tenant_id, saas_id, category);
