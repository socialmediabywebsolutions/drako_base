CREATE TABLE IF NOT EXISTS mentoria_student_evolution (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  strengths_json TEXT NOT NULL DEFAULT '[]',
  weaknesses_json TEXT NOT NULL DEFAULT '[]',
  frustration_level REAL NOT NULL DEFAULT 0.35,
  consistency_score REAL NOT NULL DEFAULT 0.5,
  average_response_time REAL NOT NULL DEFAULT 0,
  last_sessions INTEGER NOT NULL DEFAULT 0,
  common_mistakes_json TEXT NOT NULL DEFAULT '[]',
  progression_velocity REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_student_evolution_tenant_student
ON mentoria_student_evolution(tenant_id, student_profile_id);
