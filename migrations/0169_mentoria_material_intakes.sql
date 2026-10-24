CREATE TABLE IF NOT EXISTS mentoria_material_intakes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp')),
  source_message_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image')),
  intake_kind TEXT NOT NULL CHECK (intake_kind IN ('exam_photo', 'homework_photo', 'notes_photo', 'exercise_photo', 'academic_image')),
  provider_media_id TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  caption TEXT,
  original_text TEXT,
  status TEXT NOT NULL CHECK (status IN ('received')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_material_intakes_student
  ON mentoria_material_intakes (tenant_id, student_profile_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_material_intakes_source_message
  ON mentoria_material_intakes (tenant_id, source_message_id);
