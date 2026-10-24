-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Caches geocoded coordinates for saas_empresa_local.address so
-- CompetitorIntelligenceAgent doesn't need to call the Geocoding API on every run.
ALTER TABLE saas_empresa_local ADD COLUMN latitude REAL;
ALTER TABLE saas_empresa_local ADD COLUMN longitude REAL;
ALTER TABLE saas_empresa_local ADD COLUMN place_id TEXT;
ALTER TABLE saas_empresa_local ADD COLUMN geocoded_at TEXT;
