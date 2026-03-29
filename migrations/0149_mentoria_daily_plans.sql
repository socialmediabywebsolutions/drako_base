CREATE TABLE IF NOT EXISTS mentoria_daily_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  plan_date TEXT NOT NULL,
  recommended_duration INTEGER NOT NULL,
  tasks_json TEXT NOT NULL,
  completed_task_ids_json TEXT NOT NULL DEFAULT '[]',
  priority TEXT NOT NULL,
  adaptation_reason TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_daily_plans_unique
  ON mentoria_daily_plans (tenant_id, student_profile_id, plan_date);

CREATE INDEX IF NOT EXISTS idx_mentoria_daily_plans_student
  ON mentoria_daily_plans (tenant_id, student_profile_id, updated_at DESC);
