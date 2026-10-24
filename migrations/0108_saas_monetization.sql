-- Migration 0108: SaaS Monetization (Stripe Integration)

-- 1. Add Pricing Metadata to Policy Packs
-- These fields map our internal packs to Stripe Products/Prices.
ALTER TABLE saas_policy_packs ADD COLUMN stripe_product_id TEXT;
ALTER TABLE saas_policy_packs ADD COLUMN monthly_price_usd REAL DEFAULT 0.0;

-- Update Seed Data with placeholders (User must update with real Stripe IDs in Production)
UPDATE saas_policy_packs 
SET stripe_product_id = 'prod_starter', monthly_price_usd = 0.0 
WHERE pack_name = 'Starter';

UPDATE saas_policy_packs 
SET stripe_product_id = 'prod_pro', monthly_price_usd = 29.0 
WHERE pack_name = 'Pro';

UPDATE saas_policy_packs 
SET stripe_product_id = 'prod_enterprise', monthly_price_usd = 99.0 
WHERE pack_name = 'Enterprise';


-- 2. Create SaaS Subscriptions Table
-- Tracks the link between a Drako Project (SaaS) and a Stripe Subscription.
-- Supports both Tenant-level (saas_id IS NULL) and Project-level (saas_id IS NOT NULL) subscriptions.
CREATE TABLE saas_subscriptions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    saas_id TEXT, -- Nullable for Tenant-wide plans
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    stripe_price_id TEXT,
    status TEXT NOT NULL, -- active, past_due, canceled, incomplete, incomplete_expired, trialing, unpaid
    current_period_end TEXT, -- ISO Date
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(tenant_id, saas_id)
);

CREATE INDEX idx_saas_subscriptions_tenant ON saas_subscriptions(tenant_id);
CREATE INDEX idx_saas_subscriptions_stripe_sub ON saas_subscriptions(stripe_subscription_id);
