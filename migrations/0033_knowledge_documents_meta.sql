-- Add audience/importance metadata to knowledge documents.
ALTER TABLE saas_knowledge_documents
  ADD COLUMN audience TEXT NOT NULL DEFAULT 'BOTH';

ALTER TABLE saas_knowledge_documents
  ADD COLUMN importance TEXT NOT NULL DEFAULT 'STANDARD';
