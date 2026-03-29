CREATE TABLE IF NOT EXISTS mentoria_interventions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  intervention_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  recommendations_json TEXT NOT NULL DEFAULT '[]',
  channels_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_interventions_active_unique
ON mentoria_interventions(tenant_id, student_profile_id, intervention_type, status);

CREATE INDEX IF NOT EXISTS idx_mentoria_interventions_student_updated
ON mentoria_interventions(tenant_id, student_profile_id, updated_at DESC);
