-- 0037_saas_branding_core.sql
-- SaaS branding settings and per-user UI preferences

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS saas_branding_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  background_color TEXT NOT NULL,
  surface_color TEXT NOT NULL,
  text_color TEXT NOT NULL,
  danger_color TEXT NOT NULL,
  success_color TEXT NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  hero_image_url TEXT,
  layout_density TEXT NOT NULL,
  enable_dark_mode INTEGER NOT NULL DEFAULT 1,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_branding_settings_unique
  ON saas_branding_settings (tenant_id, saas_id);
CREATE INDEX IF NOT EXISTS idx_saas_branding_settings_saas
  ON saas_branding_settings (saas_id);

CREATE TABLE IF NOT EXISTS saas_user_ui_preferences (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_type TEXT NOT NULL,
  layout_density_override TEXT,
  default_section TEXT,
  hidden_widgets TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_user_ui_preferences_unique
  ON saas_user_ui_preferences (tenant_id, saas_id, user_id);
CREATE INDEX IF NOT EXISTS idx_saas_user_ui_preferences_role
  ON saas_user_ui_preferences (saas_id, role_type);

PRAGMA foreign_keys = ON;
