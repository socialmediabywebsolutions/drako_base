-- 0134_fix_missed_columns.sql
-- Fix missing columns from 0116 that were skipped because 0111 created the table first.

-- ALTER TABLE saas_instances ADD COLUMN plan_status TEXT DEFAULT 'active';
-- ALTER TABLE saas_instances ADD COLUMN trial_domain TEXT;
-- ALTER TABLE saas_instances ADD COLUMN custom_domain TEXT;
-- ALTER TABLE saas_instances ADD COLUMN domain_status TEXT DEFAULT 'pending';

-- owner_id was also in 0115 but not in 0111 or 0116. Adding it just in case it's needed by code, nullable.
-- ALTER TABLE saas_instances ADD COLUMN owner_id TEXT;
