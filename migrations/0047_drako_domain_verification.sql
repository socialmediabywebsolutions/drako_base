-- 0047_drako_domain_verification.sql
-- Add verification metadata + retry counters for saas_domains (align with workers migrations).

ALTER TABLE saas_domains ADD COLUMN verification_status TEXT;
ALTER TABLE saas_domains ADD COLUMN verification_reason TEXT;
ALTER TABLE saas_domains ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_saas_domains_tenant_status ON saas_domains (tenant_id, status);
