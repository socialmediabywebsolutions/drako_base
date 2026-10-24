-- SocialFlow Fase 2: account-level social metrics snapshots (followers, engagement rate, recent posts)

CREATE TABLE IF NOT EXISTS socialflow_social_metrics_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  followers_count INTEGER,
  following_count INTEGER,
  engagement_rate REAL,
  posts_json TEXT NOT NULL DEFAULT '[]',
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, saas_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_socialflow_social_metrics_snapshots_tenant
  ON socialflow_social_metrics_snapshots (tenant_id, saas_id);

CREATE INDEX IF NOT EXISTS idx_socialflow_social_metrics_snapshots_provider
  ON socialflow_social_metrics_snapshots (provider);
