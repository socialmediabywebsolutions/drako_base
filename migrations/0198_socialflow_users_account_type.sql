-- 0198_socialflow_users_account_type.sql
-- Segmentación influencer vs empresa elegida durante el onboarding.
-- IF NOT EXISTS evita error si la columna ya fue añadida en un deploy anterior.

ALTER TABLE socialflow_users ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'influencer';
