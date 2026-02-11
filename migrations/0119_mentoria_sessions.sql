-- Migration: MentorIA Session Engine (Phase 19)
-- Core Value Module for MentorIA Vertical

CREATE TABLE IF NOT EXISTS mentoria_sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'mentoria-core', -- Hard guard
    mentor_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('scheduled', 'active', 'completed', 'billed')),
    duration_minutes INTEGER DEFAULT 0,
    ai_tokens_used INTEGER DEFAULT 0,
    cost_est_major INTEGER DEFAULT 0, -- Estimated cost in major currency units (or smallest if changed, but sticking to major as per convention)
    price_charged_major INTEGER DEFAULT 0, -- Price charged
    metadata_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    billed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_mentoria_sessions_tenant ON mentoria_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_sessions_mentor ON mentoria_sessions(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_sessions_client ON mentoria_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_sessions_status ON mentoria_sessions(status);
