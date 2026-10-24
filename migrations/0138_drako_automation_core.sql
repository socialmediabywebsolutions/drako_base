CREATE TABLE IF NOT EXISTS drako_automation_registrations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  automation_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  schedule_mode TEXT NOT NULL DEFAULT 'manual' CHECK (schedule_mode IN ('manual','scheduled')),
  frequency_unit TEXT CHECK (frequency_unit IN ('hour','day','week')),
  frequency_value INTEGER,
  config_json TEXT,
  owner_scope TEXT NOT NULL DEFAULT 'OWNER' CHECK (owner_scope IN ('OWNER')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tenant_id, saas_id, automation_key)
);

CREATE INDEX IF NOT EXISTS idx_drako_automation_registrations_tenant_saas
ON drako_automation_registrations(tenant_id, saas_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_drako_automation_registrations_enabled
ON drako_automation_registrations(enabled, updated_at DESC);

CREATE TABLE IF NOT EXISTS drako_automation_executions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  automation_key TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual','scheduled','retry','system')),
  triggered_by TEXT,
  status TEXT NOT NULL CHECK (status IN ('RUNNING','SUCCESS','FAILED')),
  summary TEXT,
  metrics_json TEXT,
  output_json TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_drako_automation_executions_lookup
ON drako_automation_executions(tenant_id, saas_id, automation_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_drako_automation_executions_status
ON drako_automation_executions(status, created_at DESC);
