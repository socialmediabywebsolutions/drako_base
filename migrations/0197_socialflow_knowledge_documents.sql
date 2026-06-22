-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
CREATE TABLE IF NOT EXISTS socialflow_knowledge_documents (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  saas_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'text',   -- 'pdf' | 'url' | 'text'
  content_text TEXT NOT NULL DEFAULT '',
  source_url   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_sfkd_tenant_saas    ON socialflow_knowledge_documents(tenant_id, saas_id);
CREATE INDEX IF NOT EXISTS idx_sfkd_created_at     ON socialflow_knowledge_documents(created_at DESC);
