ALTER TABLE saas_appointments ADD COLUMN customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_saas_appointments_customer
  ON saas_appointments (tenant_id, saas_id, customer_id);
