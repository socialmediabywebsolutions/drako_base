-- 0074_campamento_phase2.sql
-- Real-time controls for Campamento Base (Phase 2)

-- 1. Agent Runtime State (volatile status, distinct from project config)
-- Allows agents to report "I am working on X" or "I am blocked" in real-time.
CREATE TABLE IF NOT EXISTS agent_runtime_states (
    agent_id TEXT PRIMARY KEY, -- e.g. "growth-director", "accounting-chief"
    role TEXT NOT NULL, -- GROWTH, ACCOUNTING, LEGAL, TECHOPS, SUPPORT
    status TEXT NOT NULL DEFAULT 'IDLE', -- IDLE, WORKING, BLOCKED, ERROR, OFFLINE
    current_task TEXT, -- Short description of current activity
    last_heartbeat INTEGER, -- timestamp seconds
    last_error TEXT,
    metadata_json TEXT, -- extra context
    updated_at INTEGER -- timestamp seconds
);

-- 2. Tech Incidents (Internal Ops monitoring)
-- Distinct from SaaS tickets. Used for infrastructure alerts (Propio stack).
CREATE TABLE IF NOT EXISTS tech_incidents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL, -- Usually 'DRAKO' or specific tenant
    service TEXT NOT NULL, -- D1, R2, PAGES, STRIPE, WHATSAPP, EMAIL, OTHER
    severity TEXT NOT NULL, -- CRITICAL, HIGH, MEDIUM, LOW
    status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN, INVESTIGATING, RESOLVED, MONITORING
    title TEXT NOT NULL,
    description TEXT,
    last_seen_at INTEGER NOT NULL, -- timestamp seconds
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    resolved_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tech_incidents_status ON tech_incidents(status);
CREATE INDEX IF NOT EXISTS idx_tech_incidents_service ON tech_incidents(service);
