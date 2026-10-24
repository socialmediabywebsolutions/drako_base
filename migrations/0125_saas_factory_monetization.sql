-- Migration 0125: SaaS Factory Monetization (Unified Architecture)
-- Defines the core tables for the SaaS Factory monetization engine.

-- 1. Unified Pricing Plans (Factory Level)
-- Defines plans (Starter, Pro, Scale) available for ANY SaaS instance.
DROP TABLE IF EXISTS saas_pricing_plans;
CREATE TABLE saas_pricing_plans (
    id TEXT PRIMARY KEY,
    saas_slug TEXT NOT NULL, -- Partition by SaaS Instance (e.g., 'mentor-ia', 'crypto-guru')
    plan_code TEXT NOT NULL, -- 'starter', 'pro', 'scale'
    monthly_price_cents INTEGER NOT NULL DEFAULT 0,
    limits_json TEXT NOT NULL DEFAULT '{}', -- Usage limits (AI calls, storage, etc.)
    features_json TEXT NOT NULL DEFAULT '{}', -- Feature flags
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(saas_slug, plan_code)
);

CREATE INDEX IF NOT EXISTS idx_saas_pricing_plans_slug ON saas_pricing_plans(saas_slug);


-- 2. SaaS Subscriptions (The Source of Truth)
-- Links a Tenant to a specific SaaS Plan via Stripe.
DROP TABLE IF EXISTS saas_subscriptions;
CREATE TABLE saas_subscriptions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    saas_slug TEXT NOT NULL,
    plan_code TEXT, -- Added for MRR/Dashboard aggregation
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('trial', 'active', 'past_due', 'unpaid', 'canceled')),
    current_period_end TEXT, -- ISO Date
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(tenant_id, saas_slug)
);

CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_tenant_saas ON saas_subscriptions(tenant_id, saas_slug);
CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_stripe ON saas_subscriptions(stripe_subscription_id);


-- 3. Usage Quotas (Enforcement)
-- Live tracking of usage against limits.
DROP TABLE IF EXISTS saas_usage_quotas;
CREATE TABLE saas_usage_quotas (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    saas_slug TEXT NOT NULL,
    quota_key TEXT NOT NULL, -- 'ai_calls', 'storage_gb', 'workspaces'
    current_value INTEGER NOT NULL DEFAULT 0,
    limit_value INTEGER NOT NULL, -- -1 for unlimited
    reset_at TEXT, -- ISO Date for monthly reset
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(tenant_id, saas_slug, quota_key)
);

CREATE INDEX IF NOT EXISTS idx_saas_usage_quotas_lookup ON saas_usage_quotas(tenant_id, saas_slug, quota_key);

-- 4. Audit Log for Billing Events (Optional but recommended for 'Fail Closed' auditing)
CREATE TABLE IF NOT EXISTS saas_billing_audit (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    saas_slug TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'status_change', 'quota_exceeded', 'provisioning_error'
    details_json TEXT,
    correlation_id TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_saas_billing_audit_tenant ON saas_billing_audit(tenant_id, saas_slug);
