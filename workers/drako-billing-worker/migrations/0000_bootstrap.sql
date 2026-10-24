-- Billing domain bootstrap.
-- Minimal mirrors only for migration dependencies; source of truth stays in holding events.

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  saas_slug TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  name TEXT,
  slug TEXT,
  status TEXT,
  saas_slug TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas_instances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_slug TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  saas_slug TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  saas_slug TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mentoria_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  completed_at TEXT,
  saas_slug TEXT,
  external_ids TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
