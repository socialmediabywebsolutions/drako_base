-- Mentoría: Modo Examen — registro de exámenes declarados y su seguimiento
-- El alumno (o el padre) declara un examen próximo; el sistema adapta la intensidad de sesiones.

CREATE TABLE IF NOT EXISTS mentoria_declared_exams (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  exam_date TEXT NOT NULL,             -- 'YYYY-MM-DD'
  exam_label TEXT,                     -- ej: "Examen de álgebra T1"
  difficulty TEXT NOT NULL DEFAULT 'medium',  -- 'easy' | 'medium' | 'hard'
  status TEXT NOT NULL DEFAULT 'active',      -- 'active' | 'completed' | 'cancelled'
  sessions_planned INTEGER NOT NULL DEFAULT 0,
  sessions_done INTEGER NOT NULL DEFAULT 0,
  score_after TEXT,                    -- nota obtenida (si el alumno la registra post-examen)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_declared_exams_student ON mentoria_declared_exams(student_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_declared_exams_date ON mentoria_declared_exams(exam_date);

-- Simulacros cronometrados dentro del modo examen
CREATE TABLE IF NOT EXISTS mentoria_exam_simulations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  declared_exam_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  score_percent INTEGER,               -- 0-100 si el agente puede evaluarlo
  questions_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER,
  topics_covered TEXT,                 -- JSON array de tópicos
  weak_topics TEXT,                    -- JSON array de tópicos con errores
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_simulations_exam ON mentoria_exam_simulations(declared_exam_id);
