-- 0189_socialflow_oauth_connections.sql
-- Preparatory local schema for SocialFlow OAuth ownership in SOCIAL_DB.
-- This migration does not switch connect/callback reads yet; current behavior remains active.

CREATE TABLE IF NOT EXISTS socialflow_oauth_connections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_profile_id TEXT NOT NULL,
  author_urn TEXT,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  encrypted_id_token TEXT,
  scopes TEXT,
  expires_at TEXT,
  token_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  last_validated_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, saas_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_socialflow_oauth_connections_tenant
  ON socialflow_oauth_connections (tenant_id);

CREATE INDEX IF NOT EXISTS idx_socialflow_oauth_connections_saas
  ON socialflow_oauth_connections (saas_id);

CREATE INDEX IF NOT EXISTS idx_socialflow_oauth_connections_provider
  ON socialflow_oauth_connections (provider);

CREATE INDEX IF NOT EXISTS idx_socialflow_oauth_connections_status
  ON socialflow_oauth_connections (status);

CREATE INDEX IF NOT EXISTS idx_socialflow_oauth_connections_external_profile
  ON socialflow_oauth_connections (external_profile_id);
