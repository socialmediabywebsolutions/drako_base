-- 0131_multi_tenant_coherence.sql
-- Enforces tenant isolation in provisioning_jobs and optimized lookups for saas

-- 1. Add tenant_id to provisioning_jobs (Critical for Job isolation)
-- Using DEFAULT 'unknown' to support existing rows, but application logic MUST strictly validate this.
ALTER TABLE provisioning_jobs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'unknown';

-- 2. Index for Tenant-Scoped Job Lookups
CREATE INDEX IF NOT EXISTS idx_provisioning_tenant ON provisioning_jobs(tenant_id);

-- 3. Composite Index for SaaS Lookups (Tenant + Slug)
-- Replaces/Augments existing idx_saas_tenant if it was just on tenant_id
CREATE INDEX IF NOT EXISTS idx_tenant_saas ON saas(tenant_id, slug);

-- 4. Audit: Ensure saas table has tenant_id (It should, from 0013, but good to double check via comment)
-- ALTER TABLE saas ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant'; -- Already applied in 0013
