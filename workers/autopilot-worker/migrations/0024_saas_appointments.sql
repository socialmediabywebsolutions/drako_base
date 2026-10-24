CREATE TABLE IF NOT EXISTS saas_appointments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_contact TEXT,
  scheduled_start TEXT NOT NULL,
  scheduled_end TEXT NOT NULL,
  status TEXT NOT NULL,
  price_at_booking REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_appointments_start
  ON saas_appointments (tenant_id, saas_id, scheduled_start);

CREATE INDEX IF NOT EXISTS idx_saas_appointments_employee_start
  ON saas_appointments (tenant_id, saas_id, employee_id, scheduled_start);
