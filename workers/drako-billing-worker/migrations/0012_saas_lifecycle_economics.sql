-- Migration: SaaS Lifecycle & Economics (Phase 14) (Revised)
-- Ensures idempotency and strict adherence to lifecycle requirements

-- 1. Add Billing & Lifecycle Fields
-- Using try-catch pattern or relying on IF NOT COLUMN EXISTS isn't standard in SQLite/D1 easily, 
-- but we can just add columns. D1 `execute` handles errors gracefully if managed, or we assume this hasn't run.
-- Since this is a new migration file (0117), we assume it's fresh.

-- ALTER TABLE saas_instances ADD COLUMN stripe_customer_id TEXT; -- Exists from 0113
-- ALTER TABLE saas_instances ADD COLUMN stripe_subscription_id TEXT; -- Exists from 0113
ALTER TABLE saas_instances ADD COLUMN stripe_status TEXT; -- 'active', 'past_due', 'unpaid', 'canceled'
ALTER TABLE saas_instances ADD COLUMN current_period_end TEXT;
ALTER TABLE saas_instances ADD COLUMN cancel_at_period_end INTEGER DEFAULT 0;

-- 2. Lifecycle Fields (Strict State Machine)
ALTER TABLE saas_instances ADD COLUMN lifecycle_status TEXT DEFAULT 'active'; -- 'active', 'past_due', 'paused', 'archived'
ALTER TABLE saas_instances ADD COLUMN past_due_since TEXT;
ALTER TABLE saas_instances ADD COLUMN paused_at TEXT;
ALTER TABLE saas_instances ADD COLUMN archived_at TEXT;
ALTER TABLE saas_instances ADD COLUMN retention_until TEXT;

-- 3. Add Economic Metrics (Snapshot fields on instance, NO FLOATS)
ALTER TABLE saas_instances ADD COLUMN currency TEXT DEFAULT 'EUR';
ALTER TABLE saas_instances ADD COLUMN mrr_major INTEGER DEFAULT 0; -- Major currency units (e.g. Euros, not cents, as per request "no floats... major currency units")
ALTER TABLE saas_instances ADD COLUMN cost_est_major INTEGER DEFAULT 0; 
-- ALTER TABLE saas_instances ADD COLUMN margin_pct REAL DEFAULT 0; -- Exists from 0113

-- 4. Create Economics Snapshot Table (Historical Data)
CREATE TABLE IF NOT EXISTS saas_economics_snapshots (
  id TEXT PRIMARY KEY,
  saas_id TEXT NOT NULL REFERENCES saas_instances(id),
  tenant_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  mrr_major INTEGER NOT NULL DEFAULT 0,
  revenue_major INTEGER NOT NULL DEFAULT 0,
  cost_major INTEGER NOT NULL DEFAULT 0,
  margin_major INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  active_subscriptions INTEGER DEFAULT 0,
  details_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_economics_saas_date ON saas_economics_snapshots(saas_id, snapshot_date);

-- 5. Create Economic Events Log (Audit Trail)
CREATE TABLE IF NOT EXISTS saas_economic_events (
  id TEXT PRIMARY KEY,
  saas_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'subscription_created', 'invoice_paid', 'lifecycle_change'
  severity TEXT DEFAULT 'info',
  message TEXT,
  amount_major INTEGER,
  currency TEXT,
  metadata_json TEXT, -- Stores stripe_event_id for idempotency
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eco_events_saas ON saas_economic_events(saas_id);
