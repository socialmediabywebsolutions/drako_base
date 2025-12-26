-- 0043_saas_marketing_core.sql
-- SaaS marketing plans, usage, and paid ads spend (client-side cost).

CREATE TABLE IF NOT EXISTS saas_marketing_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  included_posts_per_month INTEGER NOT NULL,
  included_campaigns_per_month INTEGER NOT NULL DEFAULT 0,
  extra_post_price NUMERIC NOT NULL DEFAULT 0,
  extra_campaign_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE TABLE IF NOT EXISTS saas_marketing_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  posts_published INTEGER NOT NULL DEFAULT 0,
  campaigns_launched INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE TABLE IF NOT EXISTS saas_paid_ads_spend (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  channel TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT "EUR",
  billed_to_client BOOLEAN NOT NULL DEFAULT 1,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_saas_marketing_plans_tenant_saas ON saas_marketing_plans(tenant_id, saas_id);
CREATE INDEX IF NOT EXISTS idx_saas_marketing_usage_period ON saas_marketing_usage(tenant_id, saas_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_saas_paid_ads_spend_period ON saas_paid_ads_spend(tenant_id, saas_id, period_year, period_month);
