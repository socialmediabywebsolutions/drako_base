-- Migration: Add tenant_id to saas_instances (Critical Fix)
-- This column was missing in initial creation or lost during refactors. 
-- It is essential for multi-tenancy.

-- ALTER TABLE saas_instances ADD COLUMN tenant_id TEXT; -- Exists from 0111

-- Index for performance (tenant isolation)
CREATE INDEX IF NOT EXISTS idx_saas_instances_tenant ON saas_instances(tenant_id);
