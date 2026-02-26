-- SAFE REPAIR: Create economic_events if missing on REMOTE
-- This was missing from the previous partial repair.

CREATE TABLE IF NOT EXISTS economic_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT,
  type TEXT NOT NULL, -- 'lifecycle_change', 'billing_success', 'billing_failure', 'intervention'
  severity TEXT DEFAULT 'info', -- 'info', 'warn', 'error', 'critical'
  message TEXT,
  payload_json TEXT, -- Full details/context
  metadata TEXT, -- JSON subset for quick indexing if needed
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_economic_events_tenant ON economic_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_economic_events_saas ON economic_events(saas_id);
CREATE INDEX IF NOT EXISTS idx_economic_events_type ON economic_events(type);
CREATE INDEX IF NOT EXISTS idx_economic_events_created ON economic_events(created_at);

-- Ensure saas_economics_snapshots also exists
CREATE TABLE IF NOT EXISTS saas_economics_snapshots (
  id TEXT PRIMARY KEY,
  saas_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL, -- YYYY-MM-DD
  
  -- Metrics at snapshot time
  mrr_major INTEGER DEFAULT 0,
  cost_est_major INTEGER DEFAULT 0,
  margin_pct REAL DEFAULT 0,
  sentiment_score INTEGER DEFAULT 0,
  
  -- State at snapshot time
  lifecycle_status TEXT,
  stripe_status TEXT,
  
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_metrics_daily ON saas_economics_snapshots(saas_id, snapshot_date);
