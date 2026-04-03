-- 0167_mentoria_guardians_tenant_id.sql
-- Add tenant_id to guardians to align with repository logic and tenant isolation

ALTER TABLE guardians ADD COLUMN tenant_id TEXT;

-- Backfill existing rows (local dev DBs may already have guardians)
UPDATE guardians SET tenant_id = family_id WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_guardians_tenant_id ON guardians(tenant_id);
