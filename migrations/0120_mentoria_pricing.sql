-- Migration: 0120_mentoria_pricing.sql
-- Description: Adds pricing plans and links them to SaaS instances for strict MRR/Usage separation.

-- 1. Create Pricing Plans Table
CREATE TABLE IF NOT EXISTS mentoria_pricing_plans (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'mentoria-core',
    name TEXT NOT NULL,
    included_sessions INTEGER NOT NULL DEFAULT 0, -- -1 for unlimited
    price_per_session_major INTEGER NOT NULL DEFAULT 0,
    monthly_fee_major INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EUR',
    active BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Link SaaS Instances to Pricing
-- Note: SQLite does not support ADD COLUMN with FOREIGN KEY directly in strict mode easily, 
-- but D1 allows ADD COLUMN. We will allow NULL for now.
ALTER TABLE saas_instances ADD COLUMN pricing_plan_id TEXT REFERENCES mentoria_pricing_plans(id);

-- 3. Seed Initial Plans (Idempotent)
INSERT OR IGNORE INTO mentoria_pricing_plans (id, name, included_sessions, monthly_fee_major, price_per_session_major)
VALUES 
    ('plan_mentoria_free', 'Free', 1, 0, 0),
    ('plan_mentoria_pro', 'Pro', 5, 4900, 1500), -- 49 EUR base, 15 EUR overage
    ('plan_mentoria_enterprise', 'Enterprise', -1, 0, 0); -- Custom fee handled via override or manual update

-- 4. Audit Log
INSERT INTO saas_economic_events (id, tenant_id, saas_id, event_type, severity, message, created_at)
SELECT 
    'evt_mig_0120_' || hex(randomblob(4)), 
    'mentoria-core', 
    'system', 
    'SYSTEM_MIGRATION', 
    'info', 
    'Applied 0120_mentoria_pricing.sql', 
    datetime('now');
