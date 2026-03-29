-- 0139_saas_subscriptions_status_alignment.sql
-- Expand canonical Stripe status support in saas_subscriptions without losing data.

ALTER TABLE saas_subscriptions RENAME TO saas_subscriptions_legacy_0139;

CREATE TABLE saas_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_slug TEXT NOT NULL,
  plan_code TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('trial', 'trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired')),
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  current_period_start TEXT,
  cancel_at_period_end INTEGER DEFAULT 0,
  stripe_price_id TEXT,
  UNIQUE(tenant_id, saas_slug)
);

INSERT INTO saas_subscriptions (
  id,
  tenant_id,
  saas_slug,
  plan_code,
  stripe_customer_id,
  stripe_subscription_id,
  status,
  current_period_end,
  created_at,
  updated_at,
  current_period_start,
  cancel_at_period_end,
  stripe_price_id
)
SELECT
  id,
  tenant_id,
  saas_slug,
  plan_code,
  stripe_customer_id,
  stripe_subscription_id,
  status,
  current_period_end,
  created_at,
  updated_at,
  current_period_start,
  cancel_at_period_end,
  stripe_price_id
FROM saas_subscriptions_legacy_0139;

DROP TABLE saas_subscriptions_legacy_0139;

CREATE INDEX idx_saas_subscriptions_tenant_saas ON saas_subscriptions(tenant_id, saas_slug);
CREATE INDEX idx_saas_subscriptions_stripe ON saas_subscriptions(stripe_subscription_id);
