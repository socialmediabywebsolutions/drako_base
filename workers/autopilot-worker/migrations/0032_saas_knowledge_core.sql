-- 0032_saas_knowledge_core.sql
-- Knowledge base spaces, documents and links.

CREATE TABLE IF NOT EXISTS saas_knowledge_spaces (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_spaces_tenant_saas_slug
  ON saas_knowledge_spaces(tenant_id, saas_id, slug);

CREATE INDEX IF NOT EXISTS idx_knowledge_spaces_tenant_saas
  ON saas_knowledge_spaces(tenant_id, saas_id);

CREATE TABLE IF NOT EXISTS saas_knowledge_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  space_id TEXT,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,
  tags TEXT,
  created_by_employee_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_status
  ON saas_knowledge_documents(tenant_id, saas_id, status);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_space
  ON saas_knowledge_documents(tenant_id, saas_id, space_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_creator
  ON saas_knowledge_documents(tenant_id, saas_id, created_by_employee_id);

CREATE TABLE IF NOT EXISTS saas_knowledge_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_links_target
  ON saas_knowledge_links(tenant_id, saas_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_links_document
  ON saas_knowledge_links(tenant_id, saas_id, document_id);
