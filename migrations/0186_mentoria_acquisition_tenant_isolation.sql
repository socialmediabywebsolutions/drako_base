-- Mentoria Acquisition Posts - Tenant Isolation (P0-1B / P2)
-- Status: NOT APPLIED to production (pending explicit approval)
-- Safety: NOT SAFE FOR REMOTE APPLY without explicit manual runbook and human approval.
--
-- Why this file is non-destructive:
-- 1) It does NOT rename or drop real tables.
-- 2) It does NOT assume acquisition_posts exists.
-- 3) It provisions a tenant-scoped staging table for controlled cutover.
--
-- Controlled cutover (future, manual, approved) must include explicit backup + rollback plan.

BEGIN TRANSACTION;

-- Create tenant-scoped staging table (fail-closed design)
CREATE TABLE IF NOT EXISTS acquisition_posts_tenant_v2 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  content TEXT NOT NULL,
  published_at TEXT NOT NULL,
  external_id TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  signups INTEGER NOT NULL DEFAULT 0,
  trial_starts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CHECK (tenant_id IS NOT NULL AND tenant_id <> '')
);

-- Indexes for tenant-scoped queries on staging table
CREATE INDEX IF NOT EXISTS idx_acquisition_posts_v2_tenant_channel
  ON acquisition_posts_tenant_v2(tenant_id, channel, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_acquisition_posts_v2_tenant_metrics
  ON acquisition_posts_tenant_v2(tenant_id, clicks, signups, trial_starts);

COMMIT;

-- MANUAL CUTOVER PRECONDITIONS (required before any remote apply/cutover):
-- - Human approval for remote operation.
-- - Verified backup/export of current acquisition_posts (if it exists).
-- - Tenant mapping strategy approved for legacy rows (fail-closed or explicit map).
-- - Rollback SQL and smoke-test checklist prepared and reviewed.
