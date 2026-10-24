-- 0130_provisioning_jobs.sql
-- Enterprise Provisioning State Machine
-- Tracks lifecycle of SaaS and Tenant provisioning with strict locking and rollback support.

CREATE TABLE IF NOT EXISTS provisioning_jobs (
    job_id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('SAAS_PROVISIONING', 'TENANT_ONBOARDING')),
    entity_id TEXT NOT NULL, -- The resulting entity ID (e.g. saas_id or tenant_id) for idempotent return
    correlation_id TEXT UNIQUE NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    
    -- State Machine
    current_state TEXT NOT NULL,
    execution_lock BOOLEAN DEFAULT 0,
    lock_acquired_at TEXT, -- Stores strftime('%Y-%m-%dT%H:%M:%fZ','now')
    
    -- Retry Logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error TEXT,
    
    -- Data Persistence
    payload_json TEXT NOT NULL, -- The blueprint or input params
    step_history_json TEXT DEFAULT '[]', -- Audit trail of steps taken
    rollback_history_json TEXT DEFAULT '[]', -- Audit trail of compensations
    
    version INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Indexes for performance and lookup
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_type_state ON provisioning_jobs(type, current_state);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_idempotency ON provisioning_jobs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_lock ON provisioning_jobs(execution_lock, lock_acquired_at);
CREATE INDEX IF NOT EXISTS idx_provisioning_entity_id ON provisioning_jobs(entity_id);
