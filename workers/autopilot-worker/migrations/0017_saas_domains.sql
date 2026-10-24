-- 0017_saas_domains.sql
-- Adds public domain metadata to the SaaS table so each clinic can expose a branded site.

ALTER TABLE saas
  ADD COLUMN public_domain TEXT;

ALTER TABLE saas
  ADD COLUMN public_subdomain TEXT;

ALTER TABLE saas
  ADD COLUMN domain_status TEXT NOT NULL DEFAULT 'unconfigured';

CREATE INDEX IF NOT EXISTS idx_saas_public_domain ON saas(public_domain);
CREATE INDEX IF NOT EXISTS idx_saas_public_subdomain ON saas(public_subdomain);
