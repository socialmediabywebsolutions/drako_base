-- SAAS INSTANCES (The Materialized Factory)
CREATE TABLE saas_instances (
    id TEXT PRIMARY KEY, -- UUID
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE, -- {slug}.drako.systems
    
    -- STATE
    status TEXT NOT NULL DEFAULT 'provisioning', -- provisioning, trial_active, active, suspended, cancelled
    blueprint_snapshot TEXT, -- JSON snapshot of the plan at creation
    
    -- BILLING / TRIAL
    trial_started_at TIMESTAMP,
    trial_ends_at TIMESTAMP,
    plan_tier TEXT DEFAULT 'trial',
    
    -- INFRA COSTS (REALITY CHECK)
    total_cost_ai REAL DEFAULT 0.0,
    total_cost_infra REAL DEFAULT 0.0,
    estimated_value_generated REAL DEFAULT 0.0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SAAS AGENTS (The Workers)
CREATE TABLE saas_agents (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL REFERENCES saas_instances(id),
    type TEXT NOT NULL, -- 'orchestrator', 'sales_rep', 'marketing_lead', 'support_bot'
    name TEXT NOT NULL,
    
    status TEXT NOT NULL DEFAULT 'offline', -- active, working, offline, error
    
    -- METRICS
    tasks_completed INTEGER DEFAULT 0,
    cost_incurred REAL DEFAULT 0.0,
    last_active_at TIMESTAMP,
    
    config TEXT, -- JSON specific config
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX idx_saas_instances_tenant ON saas_instances(tenant_id);
CREATE INDEX idx_saas_instances_slug ON saas_instances(slug);
CREATE INDEX idx_saas_agents_instance ON saas_agents(instance_id);
