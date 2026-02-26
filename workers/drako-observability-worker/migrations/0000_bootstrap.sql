-- Observability domain bootstrap.
-- Minimal mirrors only for migration dependencies; source of truth stays in holding events.

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  saas_slug TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  name TEXT,
  slug TEXT,
  vertical TEXT,
  status TEXT,
  saas_slug TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas_instances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  saas_slug TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  slug TEXT,
  saas_slug TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS core_departments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  name TEXT,
  saas_slug TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  saas_slug TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inbox_messages (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  body_preview TEXT NOT NULL,
  full_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nuevo',
  saas_id TEXT,
  department_id TEXT,
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas_domains (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  saas_id TEXT,
  domain TEXT,
  status TEXT,
  verification_status TEXT,
  verification_reason TEXT,
  saas_slug TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campamento_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  saas_id TEXT,
  saas_slug TEXT,
  type TEXT,
  severity TEXT,
  external_ids TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
