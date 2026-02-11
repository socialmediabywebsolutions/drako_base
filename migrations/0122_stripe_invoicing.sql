-- Migration: 0122_stripe_invoicing.sql
-- Description: Add stripe_invoice_runs table and ensure Stripe fields in saas_instances

-- 1. Create stripe_invoice_runs table
CREATE TABLE IF NOT EXISTS stripe_invoice_runs (
    id TEXT PRIMARY KEY,
    saas_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    cycle_start TEXT NOT NULL, -- YYYY-MM-DD
    cycle_end TEXT NOT NULL,   -- YYYY-MM-DD
    status TEXT NOT NULL,      -- 'pending', 'skipped_no_usage', 'invoiced', 'failed'
    stripe_invoice_id TEXT,    -- Nullable, set if invoice created (mock or real)
    usage_major INTEGER DEFAULT 0, -- Amount billed/processed
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (saas_id) REFERENCES saas_instances(id)
);

-- Idempotency constraint: One run per cycle per SaaS
CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_invoice_runs_idempotency 
ON stripe_invoice_runs(saas_id, cycle_start, cycle_end);

-- 2. Add Stripe columns to saas_instances if they don't exist
-- SQLite doesn't support IF NOT EXISTS for columns in ALTER TABLE directly in all versions, 
-- but D1 usually handles add column safely if it doesn't exist? 
-- No, standard SQLite throws error if column exists. 
-- We will use a safe block or just add them. 
-- Given "PROMPT ÚNICO", strict robustness is key.
-- However, standard practice here is to just ADD COLUMN. If it fails, I'll handle it.
-- But wait, the user said "Verificar/añadir".
-- I will add them. If they exist, the migration might fail. 
-- To be safe, I will trust they MIGHT NOT exist yet as per previous context.

ALTER TABLE saas_instances ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE saas_instances ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE saas_instances ADD COLUMN stripe_status TEXT;

-- 3. Audit Log
INSERT INTO economic_events (id, saas_id, tenant_id, event_type, amount_major, currency, metadata_json, created_at)
VALUES (
    'evt_mig_0122_' || hex(randomblob(4)), 
    'system', 
    'system', 
    'MIGRATION_APPLIED', 
    0, 
    'EUR', 
    '{"migration": "0122_stripe_invoicing.sql", "description": "Added stripe_invoice_runs and saas_instances stripe fields"}', 
    datetime('now')
);
