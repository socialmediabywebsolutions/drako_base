CREATE TABLE IF NOT EXISTS mentoria_academic_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  academic_record_id TEXT,
  material_intake_id TEXT,
  subject_slug TEXT,
  document_kind TEXT NOT NULL CHECK (document_kind IN ('image', 'pdf')),
  classification TEXT NOT NULL CHECK (classification IN ('exam', 'homework', 'project', 'notebook', 'behavior', 'presentation', 'custom', 'unknown')),
  source_channel TEXT NOT NULL CHECK (source_channel IN ('manual_web', 'whatsapp', 'web_upload', 'ai_extraction')),
  source_message_id TEXT,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_name TEXT,
  sha256 TEXT,
  captured_at TEXT NOT NULL,
  notes_text TEXT,
  analysis_status TEXT NOT NULL CHECK (analysis_status IN ('pending', 'analyzed', 'needs_review')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_academic_documents_student
  ON mentoria_academic_documents (tenant_id, student_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mentoria_academic_documents_subject
  ON mentoria_academic_documents (tenant_id, student_profile_id, subject_slug, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_academic_documents_source_message
  ON mentoria_academic_documents (tenant_id, source_message_id)
  WHERE source_message_id IS NOT NULL;
