-- 0064_project_entitlements_extended.sql
-- Add limits and metadata columns to project_entitlements for richer capability tracking.

PRAGMA foreign_keys = ON;

ALTER TABLE project_entitlements ADD COLUMN limits_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE project_entitlements ADD COLUMN metadata_json TEXT;
