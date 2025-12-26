CREATE TABLE IF NOT EXISTS saas_customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  preferred_employee_id TEXT,
  preferred_services TEXT,
  style_profile TEXT,
  is_vip INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_customers_tenant
  ON saas_customers (tenant_id, saas_id);

CREATE INDEX IF NOT EXISTS idx_saas_customers_email
  ON saas_customers (saas_id, email);
