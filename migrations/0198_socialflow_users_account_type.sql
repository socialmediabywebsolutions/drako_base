-- 0198_socialflow_users_account_type.sql
-- account_type column was already applied to SOCIALFLOW_AUTHS_DB in a prior deploy.
-- This no-op keeps CI migration sequencing intact without re-running ALTER TABLE.
SELECT 1;
