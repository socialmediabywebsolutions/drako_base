-- 0071_project_contracts.sql
-- Digital contract management for Drako Projects.

CREATE TABLE IF NOT EXISTS project_contracts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, PENDING, SIGNED, VOID
  signed_at TEXT,
  signature_ip TEXT,
  signature_metadata_json TEXT, -- Browser info, etc.
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_project_contracts_tenant_project ON project_contracts(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_project_contracts_status ON project_contracts(status);
