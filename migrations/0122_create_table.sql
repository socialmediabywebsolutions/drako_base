CREATE TABLE IF NOT EXISTS stripe_invoice_runs (
    id TEXT PRIMARY KEY,
    saas_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    cycle_start TEXT NOT NULL,
    cycle_end TEXT NOT NULL,
    status TEXT NOT NULL,
    stripe_invoice_id TEXT,
    usage_major INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (saas_id) REFERENCES saas_instances(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_invoice_runs_idempotency 
ON stripe_invoice_runs(saas_id, cycle_start, cycle_end);
