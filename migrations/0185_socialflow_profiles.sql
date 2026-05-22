-- P2-31C: SocialFlow profile/settings persistence on real D1 (no demo-backed runtime)
CREATE TABLE IF NOT EXISTS socialflow_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  display_name TEXT,
  brand_name TEXT,
  business_type TEXT,
  website_url TEXT,
  description TEXT,
  tone TEXT,
  audience TEXT,
  goals_json TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, saas_id)
);

CREATE INDEX IF NOT EXISTS idx_socialflow_profiles_tenant_saas
  ON socialflow_profiles (tenant_id, saas_id);
