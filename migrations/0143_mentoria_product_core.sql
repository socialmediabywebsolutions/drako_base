CREATE TABLE IF NOT EXISTS student_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  grade_level TEXT NOT NULL,
  goals_json TEXT NOT NULL DEFAULT '[]',
  emotional_baseline TEXT NOT NULL DEFAULT 'steady',
  learning_style TEXT,
  preferred_session_minutes INTEGER NOT NULL DEFAULT 25,
  streak_days INTEGER NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_tenant ON student_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS mentoria_subjects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  difficulty_weight REAL NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_subjects_tenant_slug ON mentoria_subjects(tenant_id, slug);

CREATE TABLE IF NOT EXISTS parent_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  label TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  relationship TEXT NOT NULL,
  visibility_mode TEXT NOT NULL DEFAULT 'balanced',
  daily_minutes_limit INTEGER NOT NULL DEFAULT 90,
  weekend_access INTEGER NOT NULL DEFAULT 1,
  focus_mode_required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_parent_accounts_tenant_student ON parent_accounts(tenant_id, student_profile_id);

CREATE TABLE IF NOT EXISTS mentoria_study_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  title TEXT NOT NULL,
  week_start TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  generated_by TEXT NOT NULL DEFAULT 'planner-agent',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_study_plans_tenant_student ON mentoria_study_plans(tenant_id, student_profile_id, week_start);

CREATE TABLE IF NOT EXISTS mentoria_focus_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_id TEXT,
  study_plan_id TEXT,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  distraction_events INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_focus_sessions_tenant_student ON mentoria_focus_sessions(tenant_id, student_profile_id, started_at);

CREATE TABLE IF NOT EXISTS mentoria_progress (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  mastery_score REAL NOT NULL DEFAULT 0,
  effort_score REAL NOT NULL DEFAULT 0,
  focus_score REAL NOT NULL DEFAULT 0,
  completion_rate REAL NOT NULL DEFAULT 0,
  strengths_json TEXT NOT NULL DEFAULT '[]',
  weaknesses_json TEXT NOT NULL DEFAULT '[]',
  recommended_actions_json TEXT NOT NULL DEFAULT '[]',
  last_activity_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_progress_tenant_student_subject ON mentoria_progress(tenant_id, student_profile_id, subject_id);

CREATE TABLE IF NOT EXISTS mentoria_exercises (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  session_id TEXT,
  prompt TEXT NOT NULL,
  expected_competency TEXT NOT NULL,
  difficulty_level TEXT NOT NULL,
  hints_json TEXT NOT NULL DEFAULT '[]',
  answer_guidance TEXT,
  student_answer TEXT,
  evaluation_status TEXT NOT NULL DEFAULT 'pending',
  feedback_text TEXT,
  score REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_exercises_tenant_student ON mentoria_exercises(tenant_id, student_profile_id, created_at);

ALTER TABLE mentoria_sessions ADD COLUMN student_profile_id TEXT;
ALTER TABLE mentoria_sessions ADD COLUMN subject_id TEXT;
ALTER TABLE mentoria_sessions ADD COLUMN topic TEXT;
ALTER TABLE mentoria_sessions ADD COLUMN transcript_json TEXT;
ALTER TABLE mentoria_sessions ADD COLUMN emotional_state TEXT;
ALTER TABLE mentoria_sessions ADD COLUMN tutor_summary TEXT;
ALTER TABLE mentoria_sessions ADD COLUMN recommended_next_step TEXT;
ALTER TABLE mentoria_sessions ADD COLUMN updated_at TEXT;
