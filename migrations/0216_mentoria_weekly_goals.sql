-- Mentoría: Weekly Goals
-- Mentor sets weekly goals for a student; student sees them on their dashboard

CREATE TABLE IF NOT EXISTS mentoria_weekly_goals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  week_start TEXT NOT NULL,            -- ISO date of Monday (YYYY-MM-DD)
  title TEXT NOT NULL,                 -- e.g. "Resolver 10 ejercicios de álgebra"
  subject_slug TEXT,                   -- optional subject reference
  goal_type TEXT NOT NULL DEFAULT 'task',  -- task | sessions | score
  target_value INTEGER,                -- e.g. 10 exercises, 3 sessions
  current_value INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | in_progress | done | cancelled
  notes TEXT,
  created_by TEXT NOT NULL,            -- actor userId who created
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_weekly_goals_student
  ON mentoria_weekly_goals (tenant_id, student_profile_id, week_start);

CREATE INDEX IF NOT EXISTS idx_mentoria_weekly_goals_week
  ON mentoria_weekly_goals (tenant_id, week_start);
