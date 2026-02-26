-- Phase 6: Holding Economics & Autopilot Schema

-- 1. Extend saas_instances with Financial & Governance fields
ALTER TABLE saas_instances ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE saas_instances ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE saas_instances ADD COLUMN current_pack TEXT; -- 'Starter'|'Pro'|'Enterprise'
ALTER TABLE saas_instances ADD COLUMN mrr_eur REAL DEFAULT 0;
ALTER TABLE saas_instances ADD COLUMN arr_eur REAL DEFAULT 0;
ALTER TABLE saas_instances ADD COLUMN cost_eur REAL DEFAULT 0;
ALTER TABLE saas_instances ADD COLUMN margin_eur REAL DEFAULT 0;
ALTER TABLE saas_instances ADD COLUMN margin_pct REAL DEFAULT 0;
ALTER TABLE saas_instances ADD COLUMN risk_level TEXT DEFAULT 'low'; -- 'low'|'medium'|'high'|'critical'
ALTER TABLE saas_instances ADD COLUMN degraded_mode INTEGER DEFAULT 0;
ALTER TABLE saas_instances ADD COLUMN last_overseer_run_at TEXT;
ALTER TABLE saas_instances ADD COLUMN last_stripe_sync_at TEXT;

-- 2. Create Audit Log for Economic Events
CREATE TABLE IF NOT EXISTS economic_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'STRIPE_SYNC'|'ECONOMICS_COMPUTE'|'INTERVENTION_APPLIED'
  severity TEXT NOT NULL, -- 'info'|'warn'|'critical'
  payload_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_economic_events_tenant ON economic_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_economic_events_saas ON economic_events(saas_id);
CREATE INDEX IF NOT EXISTS idx_economic_events_type ON economic_events(type);

-- 3. Create Automation Log for Interventions (Idempotency Check)
CREATE TABLE IF NOT EXISTS intervention_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'DEGRADE'|'FREEZE_EXPANSION'|'THROTTLE_AI'|'SUGGEST_UPGRADE'
  reason TEXT NOT NULL,
  status TEXT NOT NULL, -- 'applied'|'skipped'|'failed'
  details_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
