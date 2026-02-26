-- SaaS-specific Stripe plans
CREATE TABLE IF NOT EXISTS saas_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  saas_id TEXT NOT NULL REFERENCES saas(id),
  plan_code TEXT NOT NULL,
  name TEXT NOT NULL,
  billing_interval TEXT NOT NULL CHECK(billing_interval IN ('month','year')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  stripe_product_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tenant_id, saas_id, plan_code)
);
CREATE INDEX IF NOT EXISTS idx_saas_plans_tenant ON saas_plans(tenant_id, saas_id);
CREATE INDEX IF NOT EXISTS idx_saas_plans_status ON saas_plans(tenant_id, status);

-- Client subscriptions for SaaS children
CREATE TABLE IF NOT EXISTS client_saas_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  saas_id TEXT NOT NULL REFERENCES saas(id),
  saas_plan_id TEXT NOT NULL REFERENCES saas_plans(id),
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_client_saas_subscriptions_tenant ON client_saas_subscriptions(tenant_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_client_saas_subscriptions_client ON client_saas_subscriptions(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_client_saas_subscriptions_saas ON client_saas_subscriptions(tenant_id, saas_id);
