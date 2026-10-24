-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
CREATE TABLE IF NOT EXISTS saas_empresa_employees (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  saas_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  role         TEXT,
  specialty    TEXT,
  description  TEXT,
  photo_url    TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_saas_empresa_employees_tenant
  ON saas_empresa_employees(tenant_id, saas_id);

CREATE INDEX IF NOT EXISTS idx_saas_empresa_employees_active
  ON saas_empresa_employees(tenant_id, saas_id, active);
