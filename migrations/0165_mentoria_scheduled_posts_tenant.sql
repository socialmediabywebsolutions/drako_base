-- 0165_mentoria_scheduled_posts_tenant.sql
-- Hard fix: add tenant scoping to Mentoria scheduled_posts and useful indexes

BEGIN TRANSACTION;

-- Create a new table with the correct schema (tenant_id required). No saas_id until contract is adopted product-wide.
CREATE TABLE IF NOT EXISTS scheduled_posts_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  content TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  published_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (tenant_id IS NOT NULL AND tenant_id <> '')
);

-- Migrate existing data fail-closed: legacy rows get '__UNSCOPED__' tenant_id so app-level filters won't expose them.
INSERT OR IGNORE INTO scheduled_posts_new (
  id, tenant_id, post_id, channel, content, scheduled_for, status, published_at, error, created_at, updated_at
)
SELECT id,
       '__UNSCOPED__' AS tenant_id,
       post_id,
       channel,
       content,
       scheduled_for,
       status,
       published_at,
       error,
       created_at,
       updated_at
FROM scheduled_posts
WHERE id NOT IN (SELECT id FROM scheduled_posts_new);

-- Replace old table with the new schema
DROP TABLE IF EXISTS scheduled_posts_backup;
ALTER TABLE scheduled_posts RENAME TO scheduled_posts_backup;
ALTER TABLE scheduled_posts_new RENAME TO scheduled_posts;

-- Indexes for tenant-scoped access patterns
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_tenant_pending
  ON scheduled_posts(tenant_id, status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_tenant_published
  ON scheduled_posts(tenant_id, channel, published_at DESC)
  WHERE status = 'published';

COMMIT;
