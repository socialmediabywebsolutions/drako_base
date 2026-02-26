-- 0049_drako_stripe_mapping.sql
-- Stable mapping between SaaS and Stripe product/price ids.

CREATE TABLE IF NOT EXISTS saas_stripe_mapping (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  saas_slug TEXT NOT NULL,
  stripe_product_id TEXT NOT NULL,
  stripe_price_ids TEXT NOT NULL,
  stripe_price_meta TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_stripe_mapping_tenant_slug
  ON saas_stripe_mapping (tenant_id, saas_slug);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_stripe_mapping_tenant_saas
  ON saas_stripe_mapping (tenant_id, saas_id);
