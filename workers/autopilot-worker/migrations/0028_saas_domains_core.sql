-- 0028_saas_domains_core.sql
-- Creates saas_domains for primary + secondary domains.

CREATE TABLE IF NOT EXISTS saas_domains (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING_DNS',
  last_checked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_domains_tenant_saas ON saas_domains (tenant_id, saas_id);
CREATE INDEX IF NOT EXISTS idx_saas_domains_saas_primary ON saas_domains (saas_id, is_primary);
