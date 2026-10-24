-- 0046_drako_empire_runtime_constraints.sql
-- Domain normalization + uniqueness + provisioning state machine.

UPDATE saas_domains
SET domain = lower(trim(replace(replace(domain, 'https://', ''), 'http://', ''), '.'))
WHERE domain IS NOT NULL;

DELETE FROM saas_domains
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM saas_domains
  GROUP BY tenant_id, domain
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_domains_tenant_domain_unique
  ON saas_domains (tenant_id, domain);

CREATE TABLE IF NOT EXISTS campamento_provisioning (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  plan TEXT NOT NULL,
  last_error TEXT,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campamento_provisioning_tenant_saas
  ON campamento_provisioning (tenant_id, saas_id);
