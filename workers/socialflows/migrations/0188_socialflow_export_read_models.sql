-- 0188_socialflow_export_read_models.sql
-- Preparatory local schema for SocialFlow export ownership in SOCIAL_DB.
-- This migration does not switch export reads yet; core-backed fallback remains active.

CREATE TABLE IF NOT EXISTS socialflow_export_read_models (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  dossier_json TEXT NOT NULL DEFAULT '{}',
  blueprint_json TEXT NOT NULL DEFAULT '{}',
  work_logs_csv TEXT NOT NULL DEFAULT '',
  orchestrator_messages_csv TEXT NOT NULL DEFAULT '',
  financials_csv TEXT NOT NULL DEFAULT '',
  economic_events_csv TEXT NOT NULL DEFAULT '',
  domains_json TEXT NOT NULL DEFAULT '[]',
  meta_json TEXT NOT NULL DEFAULT '{}',
  source_revision TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, saas_id)
);

CREATE INDEX IF NOT EXISTS idx_socialflow_export_read_models_tenant
  ON socialflow_export_read_models (tenant_id);

CREATE INDEX IF NOT EXISTS idx_socialflow_export_read_models_saas
  ON socialflow_export_read_models (saas_id);

CREATE INDEX IF NOT EXISTS idx_socialflow_export_read_models_slug
  ON socialflow_export_read_models (slug);

CREATE INDEX IF NOT EXISTS idx_socialflow_export_read_models_status
  ON socialflow_export_read_models (status);
