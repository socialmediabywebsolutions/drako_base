-- Migration 0126: Holding Multi-SaaS Monetization
-- Defines the Unified Schema for Campamento Base Holding and its Subsidiaries.

-- A) SaaS Registry (The Subsidiaries)
CREATE TABLE IF NOT EXISTS holding_saas_registry (
    saas_slug TEXT PRIMARY KEY, -- 'drako', 'mentoria', 'socialflow'
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'beta', 'deprecated'
    default_domain TEXT,
    metadata_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- B) SaaS Tenants (Clients of a Subsidiary)
CREATE TABLE IF NOT EXISTS saas_tenants (
    tenant_id TEXT NOT NULL,
    saas_slug TEXT NOT NULL,
    company_name TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (saas_slug, tenant_id),
    FOREIGN KEY (saas_slug) REFERENCES holding_saas_registry(saas_slug) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saas_tenants_lookup ON saas_tenants(tenant_id);

-- C) SaaS Pricing Plans (Tiers per Subsidiary)
-- Replaces previous singular schema if necessary, or extends it.
-- Using 'INSERT OR REPLACE' logic in seeds, ensuring table structure supports it.
CREATE TABLE IF NOT EXISTS saas_pricing_plans (
    id TEXT PRIMARY KEY,
    saas_slug TEXT NOT NULL,
    plan_code TEXT NOT NULL, -- 'starter', 'pro', 'scale'
    stripe_product_id TEXT,
    stripe_price_id TEXT,
    monthly_price_cents INTEGER NOT NULL DEFAULT 0,
    departments_json TEXT NOT NULL DEFAULT '[]', -- List of included departments/units
    limits_json TEXT NOT NULL DEFAULT '{}',
    features_json TEXT NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(saas_slug, plan_code),
    FOREIGN KEY (saas_slug) REFERENCES holding_saas_registry(saas_slug)
);

-- Schema Patch for 0125 compatibility (Columns missing in 0125)
ALTER TABLE saas_pricing_plans ADD COLUMN stripe_product_id TEXT;
ALTER TABLE saas_pricing_plans ADD COLUMN stripe_price_id TEXT;
ALTER TABLE saas_pricing_plans ADD COLUMN departments_json TEXT DEFAULT '[]';
ALTER TABLE saas_pricing_plans ADD COLUMN is_active BOOLEAN DEFAULT 1;

-- D) SaaS Subscriptions (Billing State)
CREATE TABLE IF NOT EXISTS saas_subscriptions (
    id TEXT PRIMARY KEY,
    saas_slug TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    plan_code TEXT,
    status TEXT NOT NULL CHECK(status IN ('trial', 'active', 'past_due', 'unpaid', 'canceled')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_end TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(saas_slug, tenant_id),
    FOREIGN KEY (saas_slug, tenant_id) REFERENCES saas_tenants(saas_slug, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_stripe ON saas_subscriptions(stripe_subscription_id);

-- E) Usage Quotas (Enforcement)
CREATE TABLE IF NOT EXISTS saas_usage_quotas (
    id TEXT PRIMARY KEY,
    saas_slug TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    quota_key TEXT NOT NULL, -- 'ai_calls', 'workspaces'
    current_value INTEGER NOT NULL DEFAULT 0,
    limit_value INTEGER NOT NULL, -- -1 for unlimited
    reset_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(saas_slug, tenant_id, quota_key),
    FOREIGN KEY (saas_slug, tenant_id) REFERENCES saas_tenants(saas_slug, tenant_id)
);

-- F) Billing Audit Logs (Canon Request)
CREATE TABLE IF NOT EXISTS billing_audit_logs (
    id TEXT PRIMARY KEY,
    saas_slug TEXT,
    tenant_id TEXT,
    event_type TEXT NOT NULL, -- 'billing', 'provisioning', 'access_denied', 'quota_exceeded'
    severity TEXT NOT NULL DEFAULT 'info',
    correlation_id TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_billing_logs_time ON billing_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_billing_logs_saas ON billing_audit_logs(saas_slug);

-- G) Owner Events (Canon Request)
CREATE TABLE IF NOT EXISTS owner_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    correlation_id TEXT,
    metadata_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Seed Initial Data (Campamento Base & Subsidiaries)
INSERT OR IGNORE INTO holding_saas_registry (saas_slug, display_name, status) VALUES 
('campamento-base', 'Campamento Base Holding', 'active'),
('drako', 'Drako SaaS Factory', 'active'),
('mentoria', 'Mentoria EdTech', 'active'),
('socialflow', 'SocialFlow Marketing', 'active');

-- Seed Plans (Idempotent)
INSERT OR IGNORE INTO saas_pricing_plans (id, saas_slug, plan_code, monthly_price_cents, departments_json, limits_json, features_json) VALUES
('plan_drako_starter', 'drako', 'starter', 4900, '["default"]', '{"workspaces": 1, "ai_calls": 1000}', '{"support": "community"}'),
('plan_drako_pro', 'drako', 'pro', 19900, '["default", "marketing", "sales"]', '{"workspaces": 5, "ai_calls": 10000}', '{"support": "priority"}'),
('plan_drako_scale', 'drako', 'scale', 99900, '["*"]', '{"workspaces": -1, "ai_calls": 100000}', '{"support": "dedicated"}'),

('plan_mentoria_starter', 'mentoria', 'starter', 2900, '["school_admin"]', '{"students": 100}', '{"features": ["basic_reports"]}'),
('plan_mentoria_pro', 'mentoria', 'pro', 8900, '["school_admin", "teachers"]', '{"students": 1000}', '{"features": ["advanced_reports"]}');

