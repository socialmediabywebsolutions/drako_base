-- Migration: 0121_mentoria_billing_cycles.sql
-- Description: Adds billing cycle fields to saas_instances and creates economics snapshots table.

-- 1. Update saas_instances
-- We use ALTER TABLE for each column.
ALTER TABLE saas_instances ADD COLUMN billing_cycle_start DATE;
ALTER TABLE saas_instances ADD COLUMN billing_cycle_end DATE;
ALTER TABLE saas_instances ADD COLUMN billing_anchor_day INTEGER DEFAULT 1;

-- 2. Create Economics Snapshots
-- 2. Update Economics Snapshots (Extend 0117 schema)
-- saas_economics_snapshots schema patch
ALTER TABLE saas_economics_snapshots ADD COLUMN period_start DATE;
ALTER TABLE saas_economics_snapshots ADD COLUMN period_end DATE;
ALTER TABLE saas_economics_snapshots ADD COLUMN active_subscriptions INTEGER DEFAULT 0;
ALTER TABLE saas_economics_snapshots ADD COLUMN revenue_major INTEGER DEFAULT 0;
ALTER TABLE saas_economics_snapshots ADD COLUMN cost_major INTEGER DEFAULT 0;
ALTER TABLE saas_economics_snapshots ADD COLUMN margin_major INTEGER DEFAULT 0;

ALTER TABLE saas_economics_snapshots ADD COLUMN included_sessions_used INTEGER DEFAULT 0;
ALTER TABLE saas_economics_snapshots ADD COLUMN overage_sessions INTEGER DEFAULT 0;
ALTER TABLE saas_economics_snapshots ADD COLUMN fixed_fee_major INTEGER DEFAULT 0;
-- usage_revenue_major is covered by revenue_major
-- cost_est_major exist (checked via PRAGMA)

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_saas_period ON saas_economics_snapshots(saas_id, period_start);
CREATE INDEX IF NOT EXISTS idx_mentoria_sessions_completed ON mentoria_sessions(tenant_id, completed_at);

-- 4. Audit Log
INSERT INTO saas_economic_events (id, tenant_id, saas_id, event_type, severity, message, created_at)
SELECT 
    'evt_mig_0121_' || hex(randomblob(4)), 
    'mentoria-core', 
    'system', 
    'SYSTEM_MIGRATION', 
    'info', 
    'Applied 0121_mentoria_billing_cycles.sql', 
    datetime('now');
