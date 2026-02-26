-- Phase 8: Execution Agents Schema

-- 1. Create Work Logs Table (Proof of Work)
CREATE TABLE IF NOT EXISTS agent_work_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  agent_name TEXT NOT NULL, -- 'MARKETING_BOT' | 'SEO_OPTIMIZER'
  action_type TEXT NOT NULL, -- 'GENERATE_POSTS' | 'KEYWORD_RESEARCH'
  status TEXT NOT NULL, -- 'READY' | 'EXECUTED' | 'BLOCKED'
  output_json TEXT NOT NULL, -- The actual value delivered
  cost_eur REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_work_logs_tenant ON agent_work_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_work_logs_saas ON agent_work_logs(saas_id);
CREATE INDEX IF NOT EXISTS idx_agent_work_logs_agent ON agent_work_logs(agent_name);
