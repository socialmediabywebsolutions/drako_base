-- 0140_saas_usage_quotas_runtime_alignment.sql
-- Align quota storage with the canonical billing runtime.

ALTER TABLE saas_usage_quotas RENAME TO saas_usage_quotas_legacy_0140;

CREATE TABLE saas_usage_quotas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_slug TEXT NOT NULL,
  quota_key TEXT NOT NULL,
  limit_value INTEGER NOT NULL DEFAULT -1,
  current_value INTEGER NOT NULL DEFAULT 0,
  period_start TEXT,
  period_end TEXT,
  reset_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT,
  UNIQUE(saas_slug, tenant_id, quota_key)
);

INSERT INTO saas_usage_quotas (
  id,
  tenant_id,
  saas_slug,
  quota_key,
  limit_value,
  current_value,
  period_start,
  period_end,
  reset_at,
  created_at,
  updated_at
)
SELECT
  id,
  tenant_id,
  saas_slug,
  quota_key,
  limit_value,
  COALESCE(current_value, 0),
  period_start,
  period_end,
  reset_at,
  COALESCE(created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  COALESCE(created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
FROM saas_usage_quotas_legacy_0140;

DROP TABLE saas_usage_quotas_legacy_0140;

CREATE INDEX idx_saas_usage_quotas_lookup ON saas_usage_quotas(tenant_id, saas_slug, quota_key);
