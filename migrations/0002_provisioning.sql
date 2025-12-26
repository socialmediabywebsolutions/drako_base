-- Provisioning tracking for SaaS Creator
CREATE TABLE IF NOT EXISTS provisioning (
  id TEXT PRIMARY KEY,
  saas_id TEXT NOT NULL,
  step TEXT NOT NULL, -- init, pages_project, domain, connect, done, failed
  status TEXT NOT NULL, -- pending, running, completed, failed
  details TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (saas_id) REFERENCES saas(id)
);

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_provisioning_saas_created ON provisioning(saas_id, created_at DESC);
