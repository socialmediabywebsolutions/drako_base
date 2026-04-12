CREATE TABLE IF NOT EXISTS mentoria_material_context_notes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  material_intake_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp')),
  source_message_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (material_intake_id) REFERENCES mentoria_material_intakes(id)
);

CREATE INDEX IF NOT EXISTS idx_mentoria_material_context_notes_material
  ON mentoria_material_context_notes (tenant_id, material_intake_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_material_context_notes_source_message
  ON mentoria_material_context_notes (tenant_id, source_message_id);
