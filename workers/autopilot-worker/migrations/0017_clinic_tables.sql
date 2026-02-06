-- Clinic profiles
CREATE TABLE IF NOT EXISTS clinic_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  saas_id TEXT NOT NULL REFERENCES saas(id),
  display_name TEXT NOT NULL,
  city TEXT,
  rooms_count INTEGER DEFAULT 0,
  staff_count INTEGER DEFAULT 0,
  primary_goal TEXT NOT NULL DEFAULT 'fill_agenda',
  channels TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clinic_profiles_tenant ON clinic_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clinic_profiles_saas ON clinic_profiles(saas_id);

-- Clinic services
CREATE TABLE IF NOT EXISTS clinic_services (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  saas_id TEXT NOT NULL REFERENCES saas(id),
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  base_price REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clinic_services_tenant ON clinic_services(tenant_id, saas_id);

-- Clinic leads
CREATE TABLE IF NOT EXISTS clinic_leads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  saas_id TEXT NOT NULL REFERENCES saas(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT,
  interest TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clinic_leads_tenant ON clinic_leads(tenant_id, saas_id, status);

-- Clinic appointments
CREATE TABLE IF NOT EXISTS clinic_appointments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  saas_id TEXT NOT NULL REFERENCES saas(id),
  lead_id TEXT,
  patient_name TEXT NOT NULL,
  service_id TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  status TEXT NOT NULL DEFAULT 'booked',
  room_label TEXT,
  staff_name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clinic_appointments_tenant ON clinic_appointments(tenant_id, saas_id, starts_at);

-- Clinic reviews
CREATE TABLE IF NOT EXISTS clinic_reviews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  saas_id TEXT NOT NULL REFERENCES saas(id),
  patient_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  text TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clinic_reviews_tenant ON clinic_reviews(tenant_id, saas_id);

-- Clinic finance entries
CREATE TABLE IF NOT EXISTS clinic_finance_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  saas_id TEXT NOT NULL REFERENCES saas(id),
  appointment_id TEXT,
  service_name TEXT,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  paid_at TEXT,
  method TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clinic_finance_entries_tenant ON clinic_finance_entries(tenant_id, saas_id);
