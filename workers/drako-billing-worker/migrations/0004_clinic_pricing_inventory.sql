-- Clinic products catalogue storing consumables and retail stock
CREATE TABLE IF NOT EXISTS clinic_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  unit_label TEXT NOT NULL DEFAULT 'unit',
  unit_cost REAL NOT NULL DEFAULT 0,
  sale_price_default REAL,
  min_stock_units REAL NOT NULL DEFAULT 0,
  current_stock_units REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clinic_products_tenant_saas ON clinic_products(tenant_id, saas_id);
CREATE INDEX IF NOT EXISTS idx_clinic_products_active ON clinic_products(tenant_id, saas_id, is_active);

-- Mapping between services and products consumed per appointment
CREATE TABLE IF NOT EXISTS clinic_service_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  units_per_service REAL NOT NULL DEFAULT 0,
  waste_factor_percent REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clinic_service_products_tenant_saas ON clinic_service_products(tenant_id, saas_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_service_products_unique ON clinic_service_products(tenant_id, saas_id, service_id, product_id);
CREATE INDEX IF NOT EXISTS idx_clinic_service_products_product ON clinic_service_products(product_id);

-- Inventory movements capturing purchases, usage and manual adjustments
CREATE TABLE IF NOT EXISTS clinic_inventory_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  quantity_units REAL NOT NULL DEFAULT 0,
  unit_cost REAL,
  source_type TEXT,
  source_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clinic_inventory_movements_tenant_saas ON clinic_inventory_movements(tenant_id, saas_id);
CREATE INDEX IF NOT EXISTS idx_clinic_inventory_movements_product ON clinic_inventory_movements(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_clinic_inventory_movements_source ON clinic_inventory_movements(source_type, source_id);

-- Fixed and variable cost entries used for profitability calculations
CREATE TABLE IF NOT EXISTS clinic_cost_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  period_start TEXT,
  period_end TEXT,
  source_type TEXT,
  source_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clinic_cost_entries_tenant_saas ON clinic_cost_entries(tenant_id, saas_id);
CREATE INDEX IF NOT EXISTS idx_clinic_cost_entries_period ON clinic_cost_entries(tenant_id, saas_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_clinic_cost_entries_category ON clinic_cost_entries(tenant_id, saas_id, category);

-- Pricing configuration per SaaS controlling margins and overhead allocation
CREATE TABLE IF NOT EXISTS clinic_pricing_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  target_margin_percent REAL NOT NULL DEFAULT 0.5,
  min_margin_percent REAL NOT NULL DEFAULT 0.3,
  overhead_allocation_strategy TEXT NOT NULL DEFAULT 'PER_HOUR',
  default_service_duration_minutes INTEGER NOT NULL DEFAULT 60,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_pricing_settings_tenant_saas ON clinic_pricing_settings(tenant_id, saas_id);
