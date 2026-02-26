-- AI orchestrator bootstrap.
-- Minimal dependency mirrors only; source of truth remains in drako-core-worker.

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  saas_slug TEXT,
  trace_id TEXT,
  correlation_id TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  slug TEXT,
  trace_id TEXT,
  correlation_id TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  slug TEXT,
  name TEXT,
  status TEXT,
  trace_id TEXT,
  correlation_id TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  name TEXT,
  role TEXT,
  trace_id TEXT,
  correlation_id TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_hr_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  saas_slug TEXT,
  trace_id TEXT,
  correlation_id TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas_domains (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING_DNS',
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents_registry_mirror (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  saas_slug TEXT,
  model_name TEXT,
  status_name TEXT,
  trace_id TEXT,
  correlation_id TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
