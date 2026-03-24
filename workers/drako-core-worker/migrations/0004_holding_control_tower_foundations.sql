-- 0004_holding_control_tower_foundations.sql
-- Campo Base (holding) minimal operational tables.

CREATE TABLE IF NOT EXISTS holding_saases (
  id TEXT PRIMARY KEY,
  saas_slug TEXT NOT NULL UNIQUE,
  worker_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  status_name TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_holding_saases_status ON holding_saases(status_name, updated_at DESC);

CREATE TABLE IF NOT EXISTS holding_billing_rollups (
  saas_slug TEXT PRIMARY KEY,
  mrr REAL NOT NULL DEFAULT 0,
  churn REAL NOT NULL DEFAULT 0,
  refunds REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS holding_ops_tickets (
  id TEXT PRIMARY KEY,
  saas_slug TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status_name TEXT NOT NULL CHECK (status_name IN ('open','in_progress','resolved','closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_holding_ops_tickets_scope ON holding_ops_tickets(saas_slug, status_name, created_at DESC);

CREATE TABLE IF NOT EXISTS holding_event_logs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  saas_slug TEXT,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_holding_event_logs_scope ON holding_event_logs(source, saas_slug, created_at DESC);
