CREATE TABLE IF NOT EXISTS drako_observability_activities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('automation','integration','saas')),
  source_key TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('info','success','warning','error')),
  summary TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_drako_observability_activities_lookup
ON drako_observability_activities(tenant_id, saas_id, source_type, created_at DESC);

CREATE TABLE IF NOT EXISTS drako_observability_incidents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('automation','integration','saas')),
  source_key TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
  summary TEXT NOT NULL,
  details_json TEXT,
  opened_at TEXT NOT NULL,
  resolved_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drako_observability_incidents_lookup
ON drako_observability_incidents(tenant_id, saas_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS drako_observability_health_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('automation','integration','saas')),
  scope_key TEXT NOT NULL,
  health_status TEXT NOT NULL CHECK (health_status IN ('healthy','needs_attention','degraded','unknown')),
  freshness_status TEXT NOT NULL CHECK (freshness_status IN ('fresh','stale','unknown')),
  last_activity_at TEXT,
  open_incidents_count INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  captured_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drako_observability_health_lookup
ON drako_observability_health_snapshots(tenant_id, saas_id, scope_type, captured_at DESC);
