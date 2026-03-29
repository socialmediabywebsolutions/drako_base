BEGIN TRANSACTION;

ALTER TABLE mentoria_subjects RENAME TO mentoria_subjects_legacy_0152;
CREATE TABLE mentoria_subjects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  difficulty_band TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO mentoria_subjects (
  id, tenant_id, slug, name, description, difficulty_band, created_at, updated_at
)
SELECT
  id,
  tenant_id,
  slug,
  name,
  description,
  CASE
    WHEN COALESCE(difficulty_weight, 1) >= 1.15 THEN 'growth'
    ELSE 'core'
  END,
  COALESCE(created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  COALESCE(updated_at, created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
FROM mentoria_subjects_legacy_0152;
CREATE UNIQUE INDEX idx_mentoria_subjects_tenant_slug ON mentoria_subjects(tenant_id, slug);
DROP TABLE mentoria_subjects_legacy_0152;

ALTER TABLE mentoria_study_plans RENAME TO mentoria_study_plans_legacy_0152;
CREATE TABLE mentoria_study_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  goals_summary TEXT,
  blocks_json TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO mentoria_study_plans (
  id, tenant_id, student_profile_id, week_start, week_end, goals_summary, blocks_json, generated_by, created_at, updated_at
)
SELECT
  id,
  tenant_id,
  student_profile_id,
  week_start,
  COALESCE(date(week_start, '+6 day'), week_start),
  CASE
    WHEN json_valid(plan_json) AND json_type(plan_json, '$.goalsSummary') = 'text' THEN json_extract(plan_json, '$.goalsSummary')
    ELSE title
  END,
  CASE
    WHEN json_valid(plan_json) AND json_type(plan_json, '$.blocks') = 'array' THEN json_extract(plan_json, '$.blocks')
    ELSE '[]'
  END,
  COALESCE(generated_by, 'planner-agent'),
  COALESCE(created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  COALESCE(updated_at, created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
FROM mentoria_study_plans_legacy_0152;
CREATE INDEX idx_mentoria_study_plans_tenant_student ON mentoria_study_plans(tenant_id, student_profile_id, week_start);
DROP TABLE mentoria_study_plans_legacy_0152;

ALTER TABLE mentoria_focus_sessions RENAME TO mentoria_focus_sessions_legacy_0152;
CREATE TABLE mentoria_focus_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_id TEXT,
  study_plan_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_minutes INTEGER NOT NULL,
  distractions_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO mentoria_focus_sessions (
  id, tenant_id, student_profile_id, subject_id, study_plan_id, started_at, ended_at, duration_minutes,
  distractions_count, status, notes, created_at, updated_at
)
SELECT
  id,
  tenant_id,
  student_profile_id,
  subject_id,
  study_plan_id,
  started_at,
  completed_at,
  duration_minutes,
  COALESCE(distraction_events, 0),
  status,
  notes,
  COALESCE(created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  COALESCE(updated_at, created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
FROM mentoria_focus_sessions_legacy_0152;
CREATE INDEX idx_mentoria_focus_sessions_tenant_student ON mentoria_focus_sessions(tenant_id, student_profile_id, started_at);
DROP TABLE mentoria_focus_sessions_legacy_0152;

ALTER TABLE mentoria_progress RENAME TO mentoria_progress_legacy_0152;
CREATE TABLE mentoria_progress (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  mastery_score REAL NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 50,
  streak_days INTEGER NOT NULL DEFAULT 0,
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  exercises_completed INTEGER NOT NULL DEFAULT 0,
  weak_topics_json TEXT NOT NULL DEFAULT '[]',
  strong_topics_json TEXT NOT NULL DEFAULT '[]',
  last_activity_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO mentoria_progress (
  id, tenant_id, student_profile_id, subject_id, mastery_score, confidence_score, streak_days,
  sessions_completed, exercises_completed, weak_topics_json, strong_topics_json, last_activity_at, created_at, updated_at
)
SELECT
  p.id,
  p.tenant_id,
  p.student_profile_id,
  p.subject_id,
  COALESCE(p.mastery_score, 0),
  CASE
    WHEN p.completion_rate > 0 THEN ROUND(p.completion_rate * 100)
    WHEN p.effort_score > 0 THEN ROUND(p.effort_score * 100)
    WHEN sp.confidence_score IS NOT NULL THEN ROUND(sp.confidence_score * 100)
    ELSE 50
  END,
  COALESCE(sp.streak_days, 0),
  0,
  0,
  COALESCE(p.weaknesses_json, '[]'),
  COALESCE(p.strengths_json, '[]'),
  p.last_activity_at,
  COALESCE(p.created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  COALESCE(p.updated_at, p.created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
FROM mentoria_progress_legacy_0152 p
LEFT JOIN student_profiles sp
  ON sp.tenant_id = p.tenant_id
 AND sp.id = p.student_profile_id;
CREATE UNIQUE INDEX idx_mentoria_progress_tenant_student_subject ON mentoria_progress(tenant_id, student_profile_id, subject_id);
DROP TABLE mentoria_progress_legacy_0152;

ALTER TABLE mentoria_exercises RENAME TO mentoria_exercises_legacy_0152;
CREATE TABLE mentoria_exercises (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  session_id TEXT,
  prompt TEXT NOT NULL,
  expected_competency TEXT NOT NULL,
  hints_json TEXT NOT NULL DEFAULT '[]',
  answer_format TEXT NOT NULL,
  student_answer TEXT,
  correction_feedback TEXT,
  status TEXT NOT NULL,
  difficulty_level TEXT NOT NULL,
  score REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO mentoria_exercises (
  id, tenant_id, student_profile_id, subject_id, session_id, prompt, expected_competency, hints_json,
  answer_format, student_answer, correction_feedback, status, difficulty_level, score, created_at, updated_at
)
SELECT
  id,
  tenant_id,
  student_profile_id,
  subject_id,
  session_id,
  prompt,
  expected_competency,
  COALESCE(hints_json, '[]'),
  COALESCE(NULLIF(answer_guidance, ''), 'respuesta abierta corta'),
  student_answer,
  feedback_text,
  CASE
    WHEN evaluation_status IN ('corrected', 'completed', 'graded') THEN 'corrected'
    WHEN evaluation_status IN ('pending', 'active') THEN 'pending'
    ELSE 'pending'
  END,
  difficulty_level,
  score,
  COALESCE(created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  COALESCE(updated_at, created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
FROM mentoria_exercises_legacy_0152;
CREATE INDEX idx_mentoria_exercises_tenant_student ON mentoria_exercises(tenant_id, student_profile_id, created_at);
DROP TABLE mentoria_exercises_legacy_0152;

UPDATE mentoria_sessions
SET updated_at = COALESCE(updated_at, completed_at, created_at)
WHERE updated_at IS NULL;

COMMIT;
