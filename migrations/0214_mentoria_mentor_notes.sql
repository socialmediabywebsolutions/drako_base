-- Mentoria: notas manuales del mentor sobre un alumno
CREATE TABLE IF NOT EXISTS mentoria_mentor_notes (
  id          TEXT NOT NULL,
  tenant_id   TEXT NOT NULL,
  student_id  TEXT NOT NULL,   -- mentoria_student_profiles.id
  author_id   TEXT NOT NULL,   -- userId del mentor (owner/admin)
  author_name TEXT NOT NULL,
  body        TEXT NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'internal', -- 'internal' | 'parent' | 'student'
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (id),
  FOREIGN KEY (student_id) REFERENCES mentoria_student_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_mentor_notes_student ON mentoria_mentor_notes(tenant_id, student_id, created_at DESC);
