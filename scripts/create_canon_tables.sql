
DROP TABLE IF EXISTS holding_saas_registry;
CREATE TABLE IF NOT EXISTS holding_saas_registry (
    saas_slug TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'beta', 'deprecated'
    default_domain TEXT,
    metadata_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

DROP TABLE IF EXISTS saas_pricing_plans;
CREATE TABLE IF NOT EXISTS saas_pricing_plans (
    id TEXT PRIMARY KEY,
    saas_slug TEXT NOT NULL,
    plan_code TEXT NOT NULL,
    stripe_product_id TEXT,
    stripe_price_id TEXT,
    monthly_price_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'eur',
    limits_json TEXT NOT NULL DEFAULT '{}',
    departments_json TEXT NOT NULL DEFAULT '[]',
    features_json TEXT NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(saas_slug, plan_code)
);

DROP TABLE IF EXISTS saas_subscriptions;
CREATE TABLE IF NOT EXISTS saas_subscriptions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    saas_slug TEXT NOT NULL,
    plan_code TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_start TEXT,
    current_period_end TEXT,
    cancel_at_period_end INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT,
    UNIQUE(tenant_id, saas_slug)
);

DROP TABLE IF EXISTS saas_usage_quotas;
CREATE TABLE IF NOT EXISTS saas_usage_quotas (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    saas_slug TEXT NOT NULL,
    quota_key TEXT NOT NULL,
    limit_value INTEGER NOT NULL DEFAULT -1,
    current_value INTEGER DEFAULT 0,
    period_start TEXT,
    period_end TEXT,
    reset_at TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(tenant_id, saas_slug, quota_key, period_start)
);

DROP TABLE IF EXISTS billing_audit_logs;
CREATE TABLE IF NOT EXISTS billing_audit_logs (
    id TEXT PRIMARY KEY,
    correlation_id TEXT,
    saas_slug TEXT,
    tenant_id TEXT,
    event_type TEXT,
    stripe_event_id TEXT,
    payload_json TEXT, 
    metadata_json TEXT,
    severity TEXT DEFAULT 'info',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

DROP TABLE IF EXISTS owner_events;
CREATE TABLE IF NOT EXISTS owner_events (
    id TEXT PRIMARY KEY,
    event_type TEXT,
    payload_json TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
