-- 0138_saas_subscriptions_stripe_price_id.sql
-- Align canonical SaaS subscription storage with the live billing runtime.

ALTER TABLE saas_subscriptions ADD COLUMN stripe_price_id TEXT;
