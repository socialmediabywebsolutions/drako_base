-- 0062_projects_factory_core.sql
-- Minimal Projects Factory data model with SaaS compatibility backfill.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_tenant_slug ON projects(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_company ON projects(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON projects(tenant_id, status);

CREATE TABLE IF NOT EXISTS project_domains (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_domains_tenant_domain ON project_domains(tenant_id, domain);
CREATE INDEX IF NOT EXISTS idx_project_domains_project ON project_domains(project_id);

CREATE TABLE IF NOT EXISTS project_entitlements (
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  packs_json TEXT NOT NULL DEFAULT '[]',
  features_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, project_id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_project_entitlements_project ON project_entitlements(project_id);

-- Backfill existing SaaS records into projects for compatibility.
INSERT OR IGNORE INTO projects (id, tenant_id, company_id, name, slug, status, created_at, updated_at)
SELECT
  s.id,
  s.tenant_id,
  NULL,
  s.name,
  s.slug,
  s.status,
  COALESCE(s.created_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  COALESCE(s.created_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
FROM saas s;

-- Backfill domains mapped to SaaS projects.
INSERT OR IGNORE INTO project_domains (id, tenant_id, project_id, domain, status, created_at)
SELECT
  sd.id,
  sd.tenant_id,
  sd.saas_id,
  sd.domain,
  sd.status,
  COALESCE(sd.created_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
FROM saas_domains sd
WHERE sd.saas_id IS NOT NULL;

-- Initialize entitlements rows with empty JSON arrays.
INSERT OR IGNORE INTO project_entitlements (tenant_id, project_id, packs_json, features_json, updated_at)
SELECT
  p.tenant_id,
  p.id,
  '[]',
  '[]',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM projects p;
