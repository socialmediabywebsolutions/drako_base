-- 0063_project_domains_verification.sql
-- Adds verification support columns to project_domains.

ALTER TABLE project_domains ADD COLUMN verification_token TEXT;
ALTER TABLE project_domains ADD COLUMN last_error TEXT;
ALTER TABLE project_domains ADD COLUMN updated_at TEXT;

UPDATE project_domains
SET updated_at = created_at
WHERE updated_at IS NULL;
