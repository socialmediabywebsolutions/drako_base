CREATE TABLE IF NOT EXISTS mentoria_motivation_states (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  streak INTEGER NOT NULL DEFAULT 0,
  last_activity_at TEXT NOT NULL,
  effort_score REAL NOT NULL DEFAULT 0,
  reward_points INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  achievements_json TEXT NOT NULL DEFAULT '[]',
  motivation_profile TEXT NOT NULL DEFAULT 'stable',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_motivation_tenant_student
ON mentoria_motivation_states(tenant_id, student_profile_id);
