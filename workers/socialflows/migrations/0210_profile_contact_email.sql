-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — contact email for the weekly briefing, kept in SOCIAL_DB
-- so WeeklyBriefingAgent never needs to touch SOCIALFLOW_AUTHS_DB. Nullable, no
-- default: existing rows stay untouched until seeded by onboarding or a manual
-- profile update.
ALTER TABLE socialflow_profiles ADD COLUMN contact_email TEXT;
