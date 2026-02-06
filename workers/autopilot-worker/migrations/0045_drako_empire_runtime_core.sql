-- 0045_drako_empire_runtime_core.sql
-- Empire Runtime registry + events.

CREATE TABLE IF NOT EXISTS saas_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_projects_tenant_slug ON saas_projects (tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_saas_projects_status ON saas_projects (status);

ALTER TABLE saas_domains ADD COLUMN verification_token TEXT;
ALTER TABLE saas_domains ADD COLUMN last_error TEXT;
CREATE INDEX IF NOT EXISTS idx_saas_domains_tenant_domain ON saas_domains (tenant_id, domain);

CREATE TABLE IF NOT EXISTS saas_chats (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campamento_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_campamento_events_tenant_created ON campamento_events (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_campamento_events_saas_created ON campamento_events (saas_id, created_at);
CREATE INDEX IF NOT EXISTS idx_campamento_events_type ON campamento_events (type);
CREATE INDEX IF NOT EXISTS idx_campamento_events_correlation ON campamento_events (correlation_id);
