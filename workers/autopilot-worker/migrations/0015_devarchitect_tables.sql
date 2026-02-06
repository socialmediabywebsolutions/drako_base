-- DevArchitect storage for projects, sessions, and OLIMPO checklists
CREATE TABLE IF NOT EXISTS devarchitect_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('saas','core','experiment')),
  origin_url TEXT,
  origin TEXT,
  branch_name TEXT,
  status TEXT NOT NULL CHECK(status IN ('active','pending','broken')),
  last_build_status TEXT,
  last_action_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_devarchitect_projects_tenant ON devarchitect_projects(tenant_id, updated_at);

CREATE TABLE IF NOT EXISTS devarchitect_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  project_id TEXT NOT NULL REFERENCES devarchitect_projects(id),
  mode TEXT NOT NULL CHECK(mode IN ('Review','Fix','Refactor','Guide')),
  title TEXT NOT NULL,
  last_interaction_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_devarchitect_sessions_tenant_project ON devarchitect_sessions(tenant_id, project_id, last_interaction_at DESC);

CREATE TABLE IF NOT EXISTS devarchitect_checklists (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  project_id TEXT NOT NULL REFERENCES devarchitect_projects(id),
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ok','pending')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, project_id, key)
);
CREATE INDEX IF NOT EXISTS idx_devarchitect_checklists_project ON devarchitect_checklists(tenant_id, project_id, key);
