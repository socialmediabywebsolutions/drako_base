-- Link table to assign Agents to a SaaS
CREATE TABLE IF NOT EXISTS saas_agents (
  saas_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  role TEXT, -- optional role within the SaaS
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (saas_id, agent_id),
  FOREIGN KEY (saas_id) REFERENCES saas(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_saas_agents_saas ON saas_agents(saas_id, created_at DESC);
