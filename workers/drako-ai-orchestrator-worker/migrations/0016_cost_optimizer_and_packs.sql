-- Migration: Cost Optimizer v1 & SaaS Policy Packs (Steel Perfect + Cloudflare-first)

-- 1. AI Cost Policies: Financial governance per Tenant/SaaS
CREATE TABLE IF NOT EXISTS ai_cost_policies (
    id TEXT PRIMARY KEY, -- 'cp_' || nanoid
    tenant_id TEXT NOT NULL,
    saas_id TEXT, -- NULL = Tenant Default
    soft_limit_usd REAL DEFAULT 5.0,
    hard_limit_usd REAL DEFAULT 20.0,
    current_cost_usd REAL DEFAULT 0.0,
    latency_sla_ms INTEGER DEFAULT 2000,
    latency_strikes INTEGER DEFAULT 0,
    degraded_until TEXT, -- Timestamp when auto-downgrade expires
    downgrade_provider TEXT DEFAULT 'cloudflare',
    downgrade_model TEXT DEFAULT '@cf/meta/llama-3-8b-instruct',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(tenant_id, saas_id) -- Strict unique constraint
);

CREATE INDEX IF NOT EXISTS idx_ai_cost_policies_tenant_saas ON ai_cost_policies(tenant_id, saas_id);

-- 2. SaaS Policy Packs: Templated configurations
CREATE TABLE IF NOT EXISTS saas_policy_packs (
    id TEXT PRIMARY KEY,
    pack_name TEXT UNIQUE NOT NULL, -- 'Starter', 'Pro', 'Enterprise'
    description TEXT,
    policies_json TEXT NOT NULL, -- JSON Array of ai_provider_policies
    cost_policy_json TEXT NOT NULL, -- JSON Object for ai_cost_policies
    created_at TEXT DEFAULT (datetime('now'))
);

-- 3. Seed Data: Valid JSONs for Policies
-- STARTER: Cloudflare Only, Low Limits ($5/$20), SLA 2000ms
INSERT OR IGNORE INTO saas_policy_packs (id, pack_name, description, policies_json, cost_policy_json) 
VALUES (
    'pack_starter', 
    'Starter', 
    'Cloudflare AI only. Low cost limits.',
    '[{"task_type": "default", "mode": "fast", "provider": "cloudflare", "model": "@cf/meta/llama-3-8b-instruct", "priority": 1}, {"task_type": "default", "mode": "smart", "provider": "cloudflare", "model": "@cf/meta/llama-3.1-70b-instruct", "priority": 1}]',
    '{"soft_limit_usd": 5.0, "hard_limit_usd": 20.0, "latency_sla_ms": 2000, "downgrade_provider": "cloudflare", "downgrade_model": "@cf/meta/llama-3-8b-instruct"}'
);

-- PRO: Cloudflare + Fallback, Medium Limits ($50/$100), SLA 1500ms
INSERT OR IGNORE INTO saas_policy_packs (id, pack_name, description, policies_json, cost_policy_json) 
VALUES (
    'pack_pro', 
    'Pro', 
    'Cloudflare + Resilience. Medium limits.',
    '[{"task_type": "default", "mode": "fast", "provider": "cloudflare", "model": "@cf/meta/llama-3-8b-instruct", "priority": 1}, {"task_type": "default", "mode": "smart", "provider": "cloudflare", "model": "@cf/meta/llama-3.1-70b-instruct", "priority": 1}]',
    '{"soft_limit_usd": 50.0, "hard_limit_usd": 100.0, "latency_sla_ms": 1500, "downgrade_provider": "cloudflare", "downgrade_model": "@cf/meta/llama-3-8b-instruct"}'
);

-- ENTERPRISE: High Limits ($500/$1000), Strict SLA 1000ms
INSERT OR IGNORE INTO saas_policy_packs (id, pack_name, description, policies_json, cost_policy_json) 
VALUES (
    'pack_enterprise', 
    'Enterprise', 
    'High performance. High limits.',
    '[{"task_type": "default", "mode": "fast", "provider": "cloudflare", "model": "@cf/meta/llama-3-8b-instruct", "priority": 10}, {"task_type": "default", "mode": "smart", "provider": "cloudflare", "model": "@cf/meta/llama-3.1-70b-instruct", "priority": 10}]',
    '{"soft_limit_usd": 500.0, "hard_limit_usd": 1000.0, "latency_sla_ms": 1000, "downgrade_provider": "cloudflare", "downgrade_model": "@cf/meta/llama-3-8b-instruct"}'
);
