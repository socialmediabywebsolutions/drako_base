-- 0187_socialflow_seed_metadata.sql
-- Preparatory local schema for SocialFlow runtime seed ownership.
-- This migration does not switch runtime reads yet; core-backed fallback remains active.

CREATE TABLE IF NOT EXISTS socialflow_seed_metadata (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, saas_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_socialflow_seed_metadata_tenant_id
  ON socialflow_seed_metadata (tenant_id);

CREATE INDEX IF NOT EXISTS idx_socialflow_seed_metadata_saas_id
  ON socialflow_seed_metadata (saas_id);

CREATE INDEX IF NOT EXISTS idx_socialflow_seed_metadata_slug
  ON socialflow_seed_metadata (slug);

CREATE INDEX IF NOT EXISTS idx_socialflow_seed_metadata_domain
  ON socialflow_seed_metadata (domain);

CREATE INDEX IF NOT EXISTS idx_socialflow_seed_metadata_status
  ON socialflow_seed_metadata (status);
