PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS saases_registry (
  saas_id TEXT PRIMARY KEY,
  saas_slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status_name TEXT NOT NULL CHECK (status_name IN ('draft', 'provisioning', 'active', 'paused', 'archived')),
  owner_tenant_id TEXT,
  domain_name TEXT UNIQUE,
  worker_name TEXT,
  database_name TEXT,
  namespace_key TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_saases_registry_status_name
  ON saases_registry(status_name);

CREATE INDEX IF NOT EXISTS idx_saases_registry_owner_tenant_id
  ON saases_registry(owner_tenant_id);

CREATE TABLE IF NOT EXISTS agents_registry (
  agent_id TEXT PRIMARY KEY,
  saas_slug TEXT,
  role_name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  supervisor_agent_id TEXT,
  status_name TEXT NOT NULL CHECK (status_name IN ('active', 'disabled', 'archived', 'testing')),
  estimated_cost_per_run_major REAL NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (saas_slug) REFERENCES saases_registry(saas_slug),
  FOREIGN KEY (supervisor_agent_id) REFERENCES agents_registry(agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agents_registry_saas_slug
  ON agents_registry(saas_slug);

CREATE INDEX IF NOT EXISTS idx_agents_registry_status_name
  ON agents_registry(status_name);

CREATE TABLE IF NOT EXISTS governance_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity_name TEXT NOT NULL CHECK (severity_name IN ('info', 'warning', 'error', 'critical')),
  source_name TEXT NOT NULL,
  saas_slug TEXT,
  tenant_id TEXT,
  actor_id TEXT,
  correlation_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (saas_slug) REFERENCES saases_registry(saas_slug)
);

CREATE INDEX IF NOT EXISTS idx_governance_events_created_at
  ON governance_events(created_at);

CREATE INDEX IF NOT EXISTS idx_governance_events_saas_slug
  ON governance_events(saas_slug);

CREATE INDEX IF NOT EXISTS idx_governance_events_event_type
  ON governance_events(event_type);

CREATE TABLE IF NOT EXISTS audit_logs (
  log_id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  saas_slug TEXT,
  tenant_id TEXT,
  status_name TEXT NOT NULL CHECK (status_name IN ('success', 'failure', 'warning', 'info')),
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (saas_slug) REFERENCES saases_registry(saas_slug)
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_saas_slug
  ON audit_logs(saas_slug);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id
  ON audit_logs(actor_id);

CREATE TABLE IF NOT EXISTS analyze_optimize_scale_runs (
  run_id TEXT PRIMARY KEY,
  loop_name TEXT NOT NULL DEFAULT 'ANALYZE_OPTIMIZE_SCALE',
  phase_name TEXT NOT NULL CHECK (phase_name IN ('ANALYZE', 'OPTIMIZE', 'SCALE')),
  status_name TEXT NOT NULL CHECK (status_name IN ('started', 'completed', 'failed', 'canceled')),
  saas_slug TEXT,
  tenant_id TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  notes_text TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (saas_slug) REFERENCES saases_registry(saas_slug)
);

CREATE INDEX IF NOT EXISTS idx_aos_runs_phase_name
  ON analyze_optimize_scale_runs(phase_name);

CREATE INDEX IF NOT EXISTS idx_aos_runs_status_name
  ON analyze_optimize_scale_runs(status_name);

CREATE INDEX IF NOT EXISTS idx_aos_runs_saas_slug
  ON analyze_optimize_scale_runs(saas_slug);

CREATE INDEX IF NOT EXISTS idx_aos_runs_started_at
  ON analyze_optimize_scale_runs(started_at);
