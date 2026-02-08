-- SAFE REPAIR: Create saas_instances if missing on REMOTE
-- Includes all columns from 0117 + 0118

CREATE TABLE IF NOT EXISTS saas_instances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT, -- Added via 0118
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL, -- 'active', 'inactive', 'maintenance'
  plan_tier TEXT DEFAULT 'basic',
  
  -- Lifecycle Fields (0117)
  lifecycle_status TEXT DEFAULT 'active',
  past_due_since TEXT,
  paused_at TEXT,
  archived_at TEXT,
  retention_until TEXT,
  
  -- Billing Fields (0117)
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_status TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER DEFAULT 0,
  
  -- Economic Metrics (0117)
  currency TEXT DEFAULT 'EUR',
  mrr_major INTEGER DEFAULT 0,
  cost_est_major INTEGER DEFAULT 0, 
  margin_pct REAL DEFAULT 0,
  
  -- Metadata
  sentiment_score INTEGER DEFAULT 0,
  last_overseer_run_at TEXT,
  last_stripe_sync_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_instances_slug ON saas_instances(slug);
CREATE INDEX IF NOT EXISTS idx_saas_instances_tenant ON saas_instances(tenant_id);
