-- 0132_reconciliation_engine.sql

CREATE TABLE IF NOT EXISTS reconciliation_logs (
    id TEXT PRIMARY KEY,
    ran_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    scope TEXT NOT NULL, -- 'STRIPE_TO_D1' or 'D1_TO_STRIPE'
    mismatches_count INTEGER NOT NULL DEFAULT 0,
    details_json TEXT, -- JSON summary
    status TEXT NOT NULL DEFAULT 'COMPLETED' -- 'COMPLETED', 'FAILED'
);

CREATE TABLE IF NOT EXISTS reconciliation_mismatches (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'MISSING_IN_D1', 'MISSING_IN_STRIPE', 'STATUS_MISMATCH'
    tenant_id TEXT,
    saas_slug TEXT,
    stripe_id TEXT,
    d1_id TEXT,
    action_taken TEXT, -- 'AUTO_FIXED', 'ALERTED', 'IGNORED'
    status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'RESOLVED'
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (run_id) REFERENCES reconciliation_logs(id)
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_run ON reconciliation_mismatches(run_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_status ON reconciliation_mismatches(status);
