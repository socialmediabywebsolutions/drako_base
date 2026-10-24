-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
CREATE TABLE IF NOT EXISTS saas_empresa_local (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  saas_id        TEXT NOT NULL,
  business_name  TEXT,
  address        TEXT,
  opening_hours  TEXT,   -- texto libre o JSON, sin estructura forzada
  description    TEXT,
  niche          TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_empresa_local_tenant
  ON saas_empresa_local(tenant_id, saas_id);

CREATE TABLE IF NOT EXISTS saas_empresa_local_photos (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  saas_id      TEXT NOT NULL,
  photo_url    TEXT NOT NULL,
  photo_type   TEXT NOT NULL CHECK (photo_type IN ('exterior','interior','ambiente')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_saas_empresa_local_photos_tenant
  ON saas_empresa_local_photos(tenant_id, saas_id);
