-- Table to store Stripe subscriptions for Drako Base
CREATE TABLE IF NOT EXISTS drako_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  saas_id TEXT NOT NULL REFERENCES saas(id),
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(stripe_subscription_id)
);
CREATE INDEX IF NOT EXISTS idx_drako_subscriptions_tenant ON drako_subscriptions(tenant_id, updated_at);
