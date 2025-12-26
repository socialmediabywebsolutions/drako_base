-- Add audience/importance metadata to knowledge documents.
ALTER TABLE saas_knowledge_documents
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'BOTH';

ALTER TABLE saas_knowledge_documents
  ADD COLUMN IF NOT EXISTS importance TEXT NOT NULL DEFAULT 'STANDARD';
