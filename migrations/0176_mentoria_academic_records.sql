CREATE TABLE IF NOT EXISTS mentoria_academic_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_slug TEXT,
  record_type TEXT NOT NULL CHECK (record_type IN ('exam', 'homework', 'project', 'notebook', 'behavior', 'presentation', 'custom')),
  source_channel TEXT NOT NULL CHECK (source_channel IN ('manual_web', 'whatsapp', 'web_upload', 'ai_extraction')),
  source_ref_id TEXT NOT NULL,
  title TEXT NOT NULL,
  score_value REAL,
  score_scale REAL,
  score_label TEXT,
  recorded_at TEXT NOT NULL,
  teacher_comment TEXT,
  status TEXT NOT NULL CHECK (status IN ('provisional', 'confirmed', 'needs_review')),
  created_by_actor_type TEXT NOT NULL CHECK (created_by_actor_type IN ('student', 'guardian', 'system', 'admin')),
  created_by_actor_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_academic_records_student
  ON mentoria_academic_records (tenant_id, student_profile_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_mentoria_academic_records_subject
  ON mentoria_academic_records (tenant_id, student_profile_id, subject_slug, recorded_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_academic_records_source_ref
  ON mentoria_academic_records (tenant_id, source_ref_id);
