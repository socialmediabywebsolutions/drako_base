CREATE TABLE IF NOT EXISTS mentoria_academic_analyses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  academic_record_id TEXT NOT NULL,
  document_id TEXT,
  subject_slug TEXT,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('document_review', 'exam_correction', 'task_review')),
  mistakes_json TEXT NOT NULL DEFAULT '[]',
  weak_points_json TEXT NOT NULL DEFAULT '[]',
  strong_points_json TEXT NOT NULL DEFAULT '[]',
  recommendations_json TEXT NOT NULL DEFAULT '[]',
  board_signal_json TEXT,
  confidence_score REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('completed', 'needs_review')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_academic_analyses_student
  ON mentoria_academic_analyses (tenant_id, student_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mentoria_academic_analyses_subject
  ON mentoria_academic_analyses (tenant_id, student_profile_id, subject_slug, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_academic_analyses_record
  ON mentoria_academic_analyses (tenant_id, academic_record_id);
