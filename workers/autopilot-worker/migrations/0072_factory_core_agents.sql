-- 0072_factory_core_agents.sql
-- Core persistence for Drako Factory v1 (Agents, Swarms, Interviews, Quotes)

-- 1. Agent Catalog Versioning (Catalog code is canon, DB tracks deployments)
CREATE TABLE IF NOT EXISTS agents_catalog_versions (
    id TEXT PRIMARY KEY, -- uuid
    version_tag TEXT NOT NULL, -- e.g. "v1.0.0"
    agents_json TEXT NOT NULL, -- Full JSON dump of the catalog at this version
    deployed_at INTEGER NOT NULL, -- timestamp
    is_active INTEGER DEFAULT 0
);

-- 2. Project Swarms (Active Agents per Project)
CREATE TABLE IF NOT EXISTS projects_swarms (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL, -- References projects(id)
    agent_id TEXT NOT NULL, -- References catalog slug (e.g. "partner_media_strategies")
    config_json TEXT, -- Specific config for this agent instance
    status TEXT DEFAULT 'active', -- active, paused, disabled
    enabled_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_swarms_project ON projects_swarms(project_id);

-- 3. Interview Sessions (Engine State)
CREATE TABLE IF NOT EXISTS interviews_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT, -- Optional, if linked to existing project
    tenant_id TEXT NOT NULL, -- Owner
    vertical_slug TEXT, -- SAAS, REAL_ESTATE, etc
    current_phase INTEGER DEFAULT 0,
    context_json TEXT, -- Full extracted context
    transcript_json TEXT, -- Chat history snapshot
    status TEXT DEFAULT 'in_progress', -- in_progress, completed, abandoned
    started_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 4. Pricing Quotes (Financial Proposals)
CREATE TABLE IF NOT EXISTS pricing_quotes (
    id TEXT PRIMARY KEY,
    interview_session_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    
    -- Quote details
    currency TEXT DEFAULT 'EUR',
    monthly_base_cents INTEGER NOT NULL,
    addons_total_cents INTEGER NOT NULL,
    estimated_usage_cents INTEGER NOT NULL,
    total_monthly_cents INTEGER NOT NULL,
    
    breakdown_json TEXT NOT NULL, -- Full breakdown of costs
    
    status TEXT DEFAULT 'draft', -- draft, presented, accepted, rejected, expired
    created_at INTEGER NOT NULL,
    accepted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_quotes_interview ON pricing_quotes(interview_session_id);
