ALTER TABLE saas_customers ADD COLUMN vip_level TEXT NOT NULL DEFAULT 'REGULAR';

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
  updated_at TEXT NOT NULL
);

ALTER TABLE saas_customer_profiles ADD COLUMN style_profile_json TEXT;
ALTER TABLE saas_customer_profiles ADD COLUMN last_style_review_at TEXT;

CREATE TABLE IF NOT EXISTS saas_customer_style_notes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  note_type TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_style_notes_lookup
  ON saas_customer_style_notes (tenant_id, saas_id, customer_id, created_at);
