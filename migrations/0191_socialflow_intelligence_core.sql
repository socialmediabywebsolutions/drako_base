-- SocialFlow Fase 1: Social Audit Engine + Intelligence Feed persistence on real D1

CREATE TABLE IF NOT EXISTS socialflow_audits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  area_scores_json TEXT,
  strengths_json TEXT,
  weaknesses_json TEXT,
  opportunities_json TEXT,
  recommendations_json TEXT,
  competitor_comparison_json TEXT,
  summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, saas_id)
);

CREATE INDEX IF NOT EXISTS idx_socialflow_audits_tenant_saas
  ON socialflow_audits (tenant_id, saas_id);

CREATE TABLE IF NOT EXISTS socialflow_intelligence_feed (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  action_label TEXT,
  action_href TEXT,
  source TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_socialflow_intelligence_feed_tenant_saas
  ON socialflow_intelligence_feed (tenant_id, saas_id, status);
