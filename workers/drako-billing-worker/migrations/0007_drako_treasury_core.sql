-- 0042_drako_treasury_core.sql
-- Drako Base treasury accounts and movements

CREATE TABLE IF NOT EXISTS drako_treasury_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ("TAX_RESERVE", "INFRA_RESERVE", "AI_RESERVE", "PERSONAL_SPENDING", "GENERAL")),
  currency TEXT NOT NULL DEFAULT "EUR",
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE TABLE IF NOT EXISTS drako_treasury_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES drako_treasury_accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ("INFLOW", "OUTFLOW")),
  label TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT "EUR",
  source TEXT NOT NULL CHECK (source IN ("SaaS_RENTAL", "TAX_PAYMENT", "IA_TOOLS", "INFRA", "TRANSFER", "OTHER")),
  saas_id TEXT,
  period TEXT,
  occurred_at TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE TABLE IF NOT EXISTS drako_treasury_config (
  id TEXT PRIMARY KEY,
  tax_reserve_percent REAL,
  infra_reserve_percent REAL,
  ai_reserve_percent REAL,
  personal_target_percent REAL,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_drako_treasury_accounts_type ON drako_treasury_accounts(type);
CREATE INDEX IF NOT EXISTS idx_drako_treasury_accounts_tenant ON drako_treasury_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drako_treasury_movements_account ON drako_treasury_movements(account_id);
CREATE INDEX IF NOT EXISTS idx_drako_treasury_movements_period ON drako_treasury_movements(period);
CREATE INDEX IF NOT EXISTS idx_drako_treasury_movements_tenant ON drako_treasury_movements(tenant_id);
