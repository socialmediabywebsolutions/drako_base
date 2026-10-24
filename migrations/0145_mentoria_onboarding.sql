ALTER TABLE student_profiles ADD COLUMN full_name TEXT;
ALTER TABLE student_profiles ADD COLUMN school_year TEXT;
ALTER TABLE student_profiles ADD COLUMN learning_goals_json TEXT;
ALTER TABLE student_profiles ADD COLUMN base_emotional_state TEXT;
ALTER TABLE student_profiles ADD COLUMN preferred_study_minutes INTEGER;
ALTER TABLE student_profiles ADD COLUMN strengths_json TEXT;
ALTER TABLE student_profiles ADD COLUMN support_notes TEXT;
ALTER TABLE student_profiles ADD COLUMN emotional_baseline_json TEXT;
ALTER TABLE student_profiles ADD COLUMN learning_preference TEXT;
ALTER TABLE student_profiles ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0;

UPDATE student_profiles
SET
  full_name = COALESCE(full_name, display_name),
  school_year = COALESCE(school_year, grade_level),
  learning_goals_json = COALESCE(learning_goals_json, goals_json, '[]'),
  base_emotional_state = COALESCE(base_emotional_state, emotional_baseline, 'steady'),
  preferred_study_minutes = COALESCE(preferred_study_minutes, preferred_session_minutes, 25),
  strengths_json = COALESCE(strengths_json, '[]'),
  support_notes = COALESCE(support_notes, NULL),
  emotional_baseline_json = COALESCE(emotional_baseline_json, '{"frustration":"medium","motivation":"medium","concentration":"medium"}'),
  learning_preference = COALESCE(learning_preference, learning_style, 'step_by_step');

ALTER TABLE parent_accounts ADD COLUMN full_name TEXT;
ALTER TABLE parent_accounts ADD COLUMN relation TEXT;
ALTER TABLE parent_accounts ADD COLUMN can_view_full_progress INTEGER NOT NULL DEFAULT 1;
ALTER TABLE parent_accounts ADD COLUMN can_manage_schedule INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parent_accounts ADD COLUMN daily_study_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parent_accounts ADD COLUMN supervision_level TEXT;

UPDATE parent_accounts
SET
  full_name = COALESCE(full_name, display_name),
  relation = COALESCE(relation, relationship, label),
  supervision_level = COALESCE(supervision_level, visibility_mode, 'balanced'),
  daily_study_minutes = COALESCE(daily_study_minutes, daily_minutes_limit, 0);

CREATE TABLE IF NOT EXISTS mentoria_student_subjects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  initial_level TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_student_subjects_unique
ON mentoria_student_subjects(tenant_id, student_profile_id, subject_id);
