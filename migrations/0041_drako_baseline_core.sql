-- 0041_drako_baseline_core.sql
-- Drako Base owner baseline needs (life + work)

CREATE TABLE IF NOT EXISTS drako_owner_baseline_needs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ("LIFE", "WORK")),
  amount_monthly REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT "EUR",
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_drako_owner_baseline_needs_tenant ON drako_owner_baseline_needs(tenant_id);
