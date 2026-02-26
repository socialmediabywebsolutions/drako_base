-- Drako AI Router v1.1 - Steel Governance
-- PLURAL NAMES, INCLUDE INDICES AND TIMESTAMPS

-- AI Provider Policies: Dynamic routing rules
CREATE TABLE IF NOT EXISTS ai_provider_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT, -- NULL means tenant-wide default
  plan TEXT DEFAULT 'standard',
  task_type TEXT NOT NULL, -- marketing_copy, support_reply, admin_planning, etc.
  mode TEXT NOT NULL CHECK (mode IN ('fast', 'smart')),
  provider TEXT NOT NULL, -- 'cloudflare', 'openai', 'anthropic'
  model TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- AI Request Audits: Lightweight observability
CREATE TABLE IF NOT EXISTS ai_request_audits (
  id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  saas_id TEXT,
  task_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status INTEGER NOT NULL, -- HTTP status code
  tokens_estimated INTEGER,
  tokens_used INTEGER,
  latency_ms INTEGER,
  error_code TEXT,
  created_at TEXT NOT NULL
);

-- AI Breaker States (if rename needed, otherwise use ai_circuit_breakers)
-- We already have ai_circuit_breakers and ai_breaker_logs from previous migrations.
-- The prompt asked for ai_breaker_states / ai_breaker_logs. 
-- I will keep using ai_circuit_breakers as the "states" table but I'll ensure 
-- the logic in the router points correctly.

-- Ensure indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_policies_lookup ON ai_provider_policies(tenant_id, saas_id, task_type, mode);
CREATE INDEX IF NOT EXISTS idx_ai_audits_correlation ON ai_request_audits(correlation_id);
CREATE INDEX IF NOT EXISTS idx_ai_audits_tenant_saas ON ai_request_audits(tenant_id, saas_id);
CREATE INDEX IF NOT EXISTS idx_ai_audits_created ON ai_request_audits(created_at);

-- Seed basic defaults for Cloudflare-first approach
INSERT OR IGNORE INTO ai_provider_policies (id, tenant_id, saas_id, plan, task_type, mode, provider, model, priority, is_active, created_at, updated_at)
VALUES 
('def_fast', 'system', NULL, 'standard', 'default', 'fast', 'cloudflare', '@cf/meta/llama-3-8b-instruct', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('def_smart', 'system', NULL, 'standard', 'default', 'smart', 'cloudflare', '@cf/meta/llama-3.1-70b-instruct', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
