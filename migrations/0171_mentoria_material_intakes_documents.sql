ALTER TABLE mentoria_material_intakes RENAME TO mentoria_material_intakes_old;

CREATE TABLE mentoria_material_intakes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp')),
  source_message_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'document')),
  intake_kind TEXT NOT NULL CHECK (intake_kind IN ('exam_photo', 'homework_photo', 'notes_photo', 'exercise_photo', 'academic_image', 'exam_document', 'homework_document', 'notes_document', 'study_document', 'academic_document')),
  provider_media_id TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_name TEXT,
  caption TEXT,
  original_text TEXT,
  status TEXT NOT NULL CHECK (status IN ('received')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO mentoria_material_intakes (
  id,
  tenant_id,
  student_profile_id,
  channel,
  source_message_id,
  phone_number,
  media_type,
  intake_kind,
  provider_media_id,
  mime_type,
  file_name,
  caption,
  original_text,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  tenant_id,
  student_profile_id,
  channel,
  source_message_id,
  phone_number,
  media_type,
  intake_kind,
  provider_media_id,
  mime_type,
  NULL as file_name,
  caption,
  original_text,
  status,
  created_at,
  updated_at
FROM mentoria_material_intakes_old;

DROP TABLE mentoria_material_intakes_old;

CREATE INDEX IF NOT EXISTS idx_mentoria_material_intakes_student
  ON mentoria_material_intakes (tenant_id, student_profile_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_material_intakes_source_message
  ON mentoria_material_intakes (tenant_id, source_message_id);
