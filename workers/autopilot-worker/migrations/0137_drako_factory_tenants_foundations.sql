-- 0137_drako_factory_tenants_foundations.sql
-- Drako Factory minimal production schema for tenant lifecycle and Stripe Connect.

ALTER TABLE tenants ADD COLUMN owner_user_id TEXT;
ALTER TABLE tenants ADD COLUMN saas_slug TEXT;

UPDATE tenants
SET saas_slug = COALESCE(saas_slug, slug)
WHERE saas_slug IS NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_saas_slug ON tenants(saas_slug);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_user_id ON tenants(owner_user_id);

CREATE TABLE IF NOT EXISTS tenant_profiles (
  tenant_id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  industry TEXT,
  locale TEXT,
  timezone TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS tenant_domains (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  requested_domain TEXT NOT NULL,
  status_name TEXT NOT NULL DEFAULT 'requested' CHECK (status_name IN ('requested','validating','attached','failed')),
  cf_zone_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant ON tenant_domains(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_domains_requested_domain ON tenant_domains(requested_domain);

CREATE TABLE IF NOT EXISTS tenant_integrations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  status_name TEXT NOT NULL DEFAULT 'pending' CHECK (status_name IN ('pending','connected','failed','disabled')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant_provider ON tenant_integrations(tenant_id, provider);

CREATE TABLE IF NOT EXISTS tenant_stripe_connect (
  tenant_id TEXT PRIMARY KEY,
  connect_account_id TEXT,
  onboarding_status TEXT NOT NULL DEFAULT 'not_started' CHECK (onboarding_status IN ('not_started','pending','completed','rejected')),
  fees_config TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_stripe_connect_account ON tenant_stripe_connect(connect_account_id);

ALTER TABLE tenant_knowledge_bases ADD COLUMN kb_id TEXT;
ALTER TABLE tenant_knowledge_bases ADD COLUMN status_name TEXT NOT NULL DEFAULT 'active';

UPDATE tenant_knowledge_bases
SET kb_id = COALESCE(kb_id, id),
    status_name = COALESCE(status_name, 'active')
WHERE kb_id IS NULL OR status_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_knowledge_bases_status ON tenant_knowledge_bases(tenant_id, status_name);

CREATE TABLE IF NOT EXISTS tenant_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  type_name TEXT NOT NULL,
  status_name TEXT NOT NULL CHECK (status_name IN ('draft','validated','provisioning','live','suspended','failed')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_jobs_tenant_status ON tenant_jobs(tenant_id, status_name, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_logs_tenant_created ON tenant_audit_logs(tenant_id, created_at DESC);
