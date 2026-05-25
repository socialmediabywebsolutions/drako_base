-- 0190_socialflow_legacy_read_models.sql
-- Preparatory local schema for SocialFlow legacy modules ownership in SOCIAL_DB.
-- This migration does not switch legacy reads/writes yet; core-backed fallback remains active.

CREATE TABLE IF NOT EXISTS socialflow_legacy_strategic_dossiers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  dossier_id TEXT NOT NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  form_data_json TEXT NOT NULL DEFAULT '{}',
  analysis_data_json TEXT,
  plan_data_json TEXT,
  source_updated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, dossier_id)
);

CREATE INDEX IF NOT EXISTS idx_socialflow_legacy_dossiers_tenant
  ON socialflow_legacy_strategic_dossiers (tenant_id);

CREATE INDEX IF NOT EXISTS idx_socialflow_legacy_dossiers_status
  ON socialflow_legacy_strategic_dossiers (status);

CREATE INDEX IF NOT EXISTS idx_socialflow_legacy_dossiers_tenant_status
  ON socialflow_legacy_strategic_dossiers (tenant_id, status);

CREATE TABLE IF NOT EXISTS socialflow_legacy_tenant_progress (
  tenant_id TEXT PRIMARY KEY,
  materialization_step INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS socialflow_legacy_agent_work_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  log_id TEXT NOT NULL,
  saas_id TEXT,
  agent_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL,
  output_json TEXT NOT NULL DEFAULT '{}',
  cost_eur REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, log_id)
);

CREATE INDEX IF NOT EXISTS idx_socialflow_legacy_work_logs_tenant
  ON socialflow_legacy_agent_work_logs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_socialflow_legacy_work_logs_saas
  ON socialflow_legacy_agent_work_logs (saas_id);

CREATE INDEX IF NOT EXISTS idx_socialflow_legacy_work_logs_status
  ON socialflow_legacy_agent_work_logs (status);

CREATE TABLE IF NOT EXISTS socialflow_legacy_repository_context (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  domain TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, saas_id)
);

CREATE INDEX IF NOT EXISTS idx_socialflow_legacy_repo_context_tenant
  ON socialflow_legacy_repository_context (tenant_id);

CREATE INDEX IF NOT EXISTS idx_socialflow_legacy_repo_context_saas
  ON socialflow_legacy_repository_context (saas_id);

CREATE INDEX IF NOT EXISTS idx_socialflow_legacy_repo_context_slug
  ON socialflow_legacy_repository_context (slug);
