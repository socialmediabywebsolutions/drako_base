-- 0020_economy_core.sql
-- Core economy tables for SaaS-wide pricing, inventory, and profitability.

CREATE TABLE IF NOT EXISTS saas_services (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT,
  duration_minutes INTEGER NOT NULL,
  current_price REAL NOT NULL,
  recommended_price REAL,
  is_active INTEGER NOT NULL DEFAULT 1,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_services_tenant_saas ON saas_services(tenant_id, saas_id);
CREATE INDEX IF NOT EXISTS idx_saas_services_slug ON saas_services(saas_id, slug);

CREATE TABLE IF NOT EXISTS saas_inventory_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  unit TEXT,
  cost_per_unit REAL NOT NULL,
  stock_quantity REAL NOT NULL DEFAULT 0,
  min_stock_quantity REAL NOT NULL DEFAULT 0,
  preferred_supplier TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_inventory_items_tenant_saas ON saas_inventory_items(tenant_id, saas_id);
CREATE INDEX IF NOT EXISTS idx_saas_inventory_items_sku ON saas_inventory_items(saas_id, sku);

CREATE TABLE IF NOT EXISTS saas_inventory_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  reason TEXT,
  source TEXT,
  related_service_id TEXT,
  related_employee_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (inventory_item_id) REFERENCES saas_inventory_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saas_inventory_movements_item ON saas_inventory_movements(tenant_id, saas_id, inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_saas_inventory_movements_created ON saas_inventory_movements(tenant_id, saas_id, created_at);

CREATE TABLE IF NOT EXISTS saas_expenses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  period TEXT NOT NULL,
  from_date TEXT NOT NULL,
  to_date TEXT,
  source TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_expenses_tenant_saas_type ON saas_expenses(tenant_id, saas_id, type);

CREATE TABLE IF NOT EXISTS saas_pricing_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  target_margin_percent REAL NOT NULL,
  min_margin_percent REAL NOT NULL,
  occupancy_target_percent REAL NOT NULL,
  include_payroll INTEGER NOT NULL DEFAULT 1,
  include_rent INTEGER NOT NULL DEFAULT 1,
  include_utilities INTEGER NOT NULL DEFAULT 1,
  include_products INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, saas_id)
);

CREATE TABLE IF NOT EXISTS saas_service_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL,
  quantity_per_service REAL NOT NULL,
  metadata TEXT,
  FOREIGN KEY (service_id) REFERENCES saas_services(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_item_id) REFERENCES saas_inventory_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saas_service_products_service ON saas_service_products(tenant_id, saas_id, service_id);
