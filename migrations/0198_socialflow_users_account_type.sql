-- 0198_socialflow_users_account_type.sql
-- Segmentación influencer vs empresa elegida durante el onboarding.

ALTER TABLE socialflow_users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'influencer';
