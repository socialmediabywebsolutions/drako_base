-- Tax & Accounting Engine v1
CREATE TABLE IF NOT EXISTS saas_tax_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT,
  regime TEXT NOT NULL,
  default_vat_rate REAL NOT NULL,
  reduced_vat_rate REAL,
  super_reduced_vat_rate REAL,
  uses_withholding INTEGER NOT NULL,
  withholding_rate REAL,
  income_tax_mode TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, saas_id)
);

CREATE TABLE IF NOT EXISTS saas_tax_periods (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  period_type TEXT NOT NULL,
  period_key TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL,
  estimated_revenue REAL NOT NULL DEFAULT 0,
  estimated_expenses REAL NOT NULL DEFAULT 0,
  vat_collected REAL NOT NULL DEFAULT 0,
  vat_paid REAL NOT NULL DEFAULT 0,
  vat_due REAL NOT NULL DEFAULT 0,
  income_tax_base REAL NOT NULL DEFAULT 0,
  income_tax_due REAL NOT NULL DEFAULT 0,
  notes TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, saas_id, period_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_saas_tax_profiles_saas ON saas_tax_profiles (saas_id);
CREATE INDEX IF NOT EXISTS idx_saas_tax_periods_status ON saas_tax_periods (tenant_id, saas_id, status);
