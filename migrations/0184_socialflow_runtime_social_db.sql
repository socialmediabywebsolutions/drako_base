-- 0184_socialflow_runtime_social_db.sql
-- Runtime-local SocialFlow persistence tables used by the isolated canary runtime.
--
-- Note: legacy databases created from 0026_social_core.sql may need the one-time
-- compatibility patch `ALTER TABLE saas_social_posts ADD COLUMN channel_id TEXT`
-- before applying indexes that include channel-aware runtime flows.

CREATE TABLE IF NOT EXISTS saas_social_channels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS socialflow_runtime_channel_profiles (
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, saas_id, channel_id)
);

CREATE TABLE IF NOT EXISTS socialflow_runtime_channel_competitors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS socialflow_runtime_channel_assets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runtime_social_accounts_workspace
  ON saas_social_accounts (tenant_id, saas_id, provider);

CREATE INDEX IF NOT EXISTS idx_runtime_social_channels_workspace
  ON saas_social_channels (tenant_id, saas_id, provider);

CREATE INDEX IF NOT EXISTS idx_runtime_social_campaigns_workspace
  ON saas_social_campaigns (tenant_id, saas_id, status);

CREATE INDEX IF NOT EXISTS idx_runtime_social_posts_workspace
  ON saas_social_posts (tenant_id, saas_id, status);

CREATE INDEX IF NOT EXISTS idx_socialflow_runtime_channel_competitors_workspace
  ON socialflow_runtime_channel_competitors (tenant_id, saas_id, channel_id);

CREATE INDEX IF NOT EXISTS idx_socialflow_runtime_channel_assets_workspace
  ON socialflow_runtime_channel_assets (tenant_id, saas_id, channel_id);
