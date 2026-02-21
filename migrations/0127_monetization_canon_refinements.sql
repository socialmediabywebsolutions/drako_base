
-- Migration 0127: Canon Monetization Refinements
-- Aligning schema strictly with "Campamento Base Standard" requirements.

-- 1. SaaS Pricing Plans - Add Currency
ALTER TABLE saas_pricing_plans ADD COLUMN currency TEXT DEFAULT 'eur';

-- 2. SaaS Subscriptions - Add Period & Cancellation Fields
ALTER TABLE saas_subscriptions ADD COLUMN current_period_start TEXT;
-- ALTER TABLE saas_subscriptions ADD COLUMN current_period_end TEXT; -- Exists from 0125/0126
ALTER TABLE saas_subscriptions ADD COLUMN cancel_at_period_end INTEGER DEFAULT 0;

-- 3. SaaS Usage Quotas - Add Period Windows
ALTER TABLE saas_usage_quotas ADD COLUMN period_start TEXT;
ALTER TABLE saas_usage_quotas ADD COLUMN period_end TEXT;

-- 4. Ensure Billing Audit Logs has payload_json (alias or new column)
-- We previously used details_json or metadata_json. Let's standardize on payload_json as requested, 
-- or ensure our code maps it. To be safe, adding payload_json column.
ALTER TABLE billing_audit_logs ADD COLUMN payload_json TEXT;
