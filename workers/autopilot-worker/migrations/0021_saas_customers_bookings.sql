-- 0021_saas_customers_bookings.sql
-- Multi-tenant customers, profiles, bookings, and metrics.

CREATE TABLE IF NOT EXISTS saas_customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_vip INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_customers_tenant_saas ON saas_customers(tenant_id, saas_id);

CREATE TABLE IF NOT EXISTS saas_customer_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  tags TEXT,
  preferences TEXT,
  birthday TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES saas_customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saas_customer_profiles_tenant_saas_customer ON saas_customer_profiles(tenant_id, saas_id, customer_id);

CREATE TABLE IF NOT EXISTS saas_customer_bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  employee_id TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL,
  price_at_booking REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES saas_customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saas_customer_bookings_customer ON saas_customer_bookings(tenant_id, saas_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_saas_customer_bookings_start_time ON saas_customer_bookings(tenant_id, saas_id, start_time);

CREATE TABLE IF NOT EXISTS saas_customer_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  total_visits INTEGER NOT NULL DEFAULT 0,
  total_revenue REAL NOT NULL DEFAULT 0,
  last_visit_at TEXT,
  avg_ticket REAL,
  no_show_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES saas_customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saas_customer_metrics_customer ON saas_customer_metrics(tenant_id, saas_id, customer_id);
