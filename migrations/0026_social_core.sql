CREATE TABLE IF NOT EXISTS saas_social_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  handle TEXT,
  display_name TEXT,
  status TEXT NOT NULL,
  auth_meta TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_social_accounts_tenant
  ON saas_social_accounts (tenant_id, saas_id);

CREATE INDEX IF NOT EXISTS idx_saas_social_accounts_provider
  ON saas_social_accounts (saas_id, provider);

CREATE TABLE IF NOT EXISTS saas_social_campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL,
  target_segment TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  budget_estimate REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_social_campaigns_tenant
  ON saas_social_campaigns (tenant_id, saas_id);

CREATE INDEX IF NOT EXISTS idx_saas_social_campaigns_status
  ON saas_social_campaigns (saas_id, status);

CREATE TABLE IF NOT EXISTS saas_social_posts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  campaign_id TEXT,
  provider TEXT NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_hint TEXT,
  status TEXT NOT NULL,
  scheduled_at TEXT,
  posted_at TEXT,
  external_post_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_social_posts_campaign
  ON saas_social_posts (tenant_id, saas_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_saas_social_posts_status
  ON saas_social_posts (tenant_id, saas_id, status);

CREATE TABLE IF NOT EXISTS saas_social_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  impressions INTEGER NOT NULL,
  likes INTEGER NOT NULL,
  comments INTEGER NOT NULL,
  shares INTEGER NOT NULL,
  clicks INTEGER NOT NULL,
  leads_generated INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_saas_social_metrics_post
  ON saas_social_metrics (tenant_id, saas_id, post_id);

CREATE INDEX IF NOT EXISTS idx_saas_social_metrics_captured
  ON saas_social_metrics (tenant_id, saas_id, captured_at);
