CREATE TABLE IF NOT EXISTS saas_instances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'provisioning',
  blueprint_snapshot TEXT,
  trial_started_at TIMESTAMP,
  trial_ends_at TIMESTAMP,
  plan_tier TEXT DEFAULT 'trial',
  plan_status TEXT DEFAULT 'active',
  total_cost_ai REAL DEFAULT 0.0,
  total_cost_infra REAL DEFAULT 0.0,
  estimated_value_generated REAL DEFAULT 0.0,
  trial_domain TEXT NOT NULL DEFAULT '',
  custom_domain TEXT,
  domain_status TEXT NOT NULL DEFAULT 'none',
  domain_verify_token TEXT,
  domain_last_checked_at TEXT,
  domain_error TEXT,
  domain_provider TEXT NOT NULL DEFAULT 'cloudflare',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saas_instances_tenant ON saas_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saas_instances_slug ON saas_instances(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_instances_custom_domain ON saas_instances(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saas_instances_domain_status ON saas_instances(domain_status);
