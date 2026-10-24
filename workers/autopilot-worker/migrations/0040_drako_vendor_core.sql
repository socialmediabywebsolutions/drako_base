-- 0040_drako_vendor_core.sql
-- Drako Base vendor-level expenses table (single-tenant for Drako Base itself)

CREATE TABLE IF NOT EXISTS drako_vendor_expenses (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ("INFRA", "AI", "MARKETING", "SUPPORT", "TEAM", "OTHER")),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT "EUR",
  period TEXT NOT NULL CHECK (period IN ("MONTHLY", "YEARLY", "ONE_OFF")),
  from_date TEXT NOT NULL,
  to_date TEXT,
  vertical_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_drako_vendor_expenses_vertical ON drako_vendor_expenses(vertical_id);
CREATE INDEX IF NOT EXISTS idx_drako_vendor_expenses_period ON drako_vendor_expenses(period);
