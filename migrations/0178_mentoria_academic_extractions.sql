CREATE TABLE IF NOT EXISTS mentoria_academic_extractions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  academic_record_id TEXT,
  subject_slug TEXT,
  extracted_record_type TEXT,
  extracted_score_value REAL,
  extracted_score_scale REAL,
  extracted_score_label TEXT,
  extracted_teacher_comment TEXT,
  extracted_exam_date TEXT,
  confidence_score REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('extracted', 'needs_review')),
  raw_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_academic_extractions_student
  ON mentoria_academic_extractions (tenant_id, student_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mentoria_academic_extractions_subject
  ON mentoria_academic_extractions (tenant_id, student_profile_id, subject_slug, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_academic_extractions_document
  ON mentoria_academic_extractions (tenant_id, document_id);
