CREATE TABLE IF NOT EXISTS mentoria_student_subject_memory (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_slug TEXT NOT NULL,
  concept_key TEXT NOT NULL,
  confidence_level TEXT NOT NULL DEFAULT 'medium',
  mastery_level TEXT NOT NULL DEFAULT 'developing',
  recurrence_count INTEGER NOT NULL DEFAULT 0,
  last_error_type TEXT,
  preferred_support_style TEXT NOT NULL DEFAULT 'step_by_step',
  last_worked_at TEXT NOT NULL,
  needs_reinforcement INTEGER NOT NULL DEFAULT 0,
  evidence_summary TEXT NOT NULL DEFAULT '',
  internal_summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (student_profile_id) REFERENCES student_profiles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_student_subject_memory_unique
  ON mentoria_student_subject_memory(tenant_id, student_profile_id, subject_slug, concept_key);

CREATE INDEX IF NOT EXISTS idx_mentoria_student_subject_memory_reinforcement
  ON mentoria_student_subject_memory(tenant_id, student_profile_id, needs_reinforcement, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_mentoria_student_subject_memory_subject
  ON mentoria_student_subject_memory(tenant_id, student_profile_id, subject_slug, updated_at DESC);
