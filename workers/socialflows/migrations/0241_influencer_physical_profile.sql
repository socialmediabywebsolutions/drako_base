CREATE TABLE IF NOT EXISTS socialcors_physical_profile (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  reference_image_url TEXT,
  height_cm INTEGER,
  weight_kg REAL,
  body_type TEXT CHECK (body_type IN ('atletica','fibrada','normal','curvilinea','musculosa')),
  chest_cm INTEGER,
  waist_cm INTEGER,
  hips_cm INTEGER,
  fitness_style TEXT CHECK (fitness_style IN ('competicion','funcional','crossfit','yoga','pilates','lifestyle','running')),
  skin_tone TEXT,
  hair_color TEXT,
  hair_length TEXT CHECK (hair_length IN ('corto','medio','largo')),
  extra_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
