-- DRĀKO D1 initial schema
-- owners: single-owner for DRĀKO
CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- saas projects managed by DRĀKO
CREATE TABLE IF NOT EXISTS saas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  domain TEXT,
  subdomain TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- departments catalog
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- agents per department
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department_id TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- alerts feed
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- metrics rollups (simple key-value per scope)
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  ai_cost_cents INTEGER NOT NULL DEFAULT 0,
  roi REAL NOT NULL DEFAULT 0,
  captured_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- grants opportunities
CREATE TABLE IF NOT EXISTS grants (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  region TEXT,
  deadline TEXT,
  budget_cents INTEGER,
  requirements TEXT,
  link TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- agent runs for logging
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  saas_id TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (saas_id) REFERENCES saas(id)
);

-- seed departments
INSERT OR IGNORE INTO departments (id, name) VALUES
  ('admin','Administration'),
  ('finance','Finance'),
  ('marketing','Marketing'),
  ('social','Social Media'),
  ('engineering','Engineering'),
  ('support','Support'),
  ('analytics','Analytics'),
  ('security','Security'),
  ('grants','Grants & Fundings');
