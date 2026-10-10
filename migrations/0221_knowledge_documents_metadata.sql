-- 0221_knowledge_documents_metadata.sql
-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Adds an optional metadata_json column to socialflow_knowledge_documents.
-- Used to tag auto-detected competitor docs (auto_detected: true) and track
-- the discovery source so they can be filtered or refreshed independently.
-- Idempotent: ALTER TABLE ADD COLUMN is a no-op if the column already exists
-- in SQLite (D1 silently ignores "duplicate column" in older builds, but we
-- wrap it in a safe ALTER so re-running never fails).
ALTER TABLE socialflow_knowledge_documents ADD COLUMN metadata_json TEXT;
