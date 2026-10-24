-- Steel v1.0.1 - Step 4: Audit Tables

-- Rate Limit Drops Audit
CREATE TABLE IF NOT EXISTS rate_limit_audits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT,
  route TEXT NOT NULL,
  limit_type TEXT NOT NULL, -- 'RPM', 'BURST'
  limit_value INTEGER NOT NULL,
  current_count INTEGER NOT NULL,
  ip TEXT,
  correlation_id TEXT,
  created_at TEXT NOT NULL
);

-- AI Circuit Breaker Logs
CREATE TABLE IF NOT EXISTS ai_breaker_logs (
  id TEXT PRIMARY KEY,
  breaker_key TEXT NOT NULL,
  previous_state TEXT NOT NULL,
  new_state TEXT NOT NULL,
  reason TEXT,
  correlation_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_audits_tenant ON rate_limit_audits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_breaker_logs_key ON ai_breaker_logs(breaker_key);
