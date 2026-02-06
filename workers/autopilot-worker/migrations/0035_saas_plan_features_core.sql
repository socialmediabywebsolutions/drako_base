CREATE TABLE IF NOT EXISTS saas_plan_features (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (plan_id, feature_key),
  FOREIGN KEY (plan_id) REFERENCES saas_plans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saas_plan_features_plan
  ON saas_plan_features (plan_id);
