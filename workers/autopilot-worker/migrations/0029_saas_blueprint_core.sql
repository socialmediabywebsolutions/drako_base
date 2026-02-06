-- 0029_saas_blueprint_core.sql
-- Blueprint and module factory tables for SaaS.

CREATE TABLE IF NOT EXISTS saas_blueprints (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  business_type TEXT NOT NULL,
  primary_goal TEXT NOT NULL,
  maturity_stage TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_blueprints_tenant_saas ON saas_blueprints (tenant_id, saas_id);

CREATE TABLE IF NOT EXISTS saas_modules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  phase INTEGER NOT NULL,
  status TEXT NOT NULL,
  importance INTEGER NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_modules_tenant_saas ON saas_modules (tenant_id, saas_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_modules_code_unique ON saas_modules (tenant_id, saas_id, code);

CREATE TABLE IF NOT EXISTS saas_interview_answers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  question_code TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_interview_answers_tenant_saas ON saas_interview_answers (tenant_id, saas_id);
