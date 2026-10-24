-- Mentoría: sistema de progresión visual (XP, niveles, rachas, logros)
-- Asociado al alumno (student_id). Un registro por alumno.

CREATE TABLE IF NOT EXISTS mentoria_student_progression (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL UNIQUE,
  xp_total INTEGER NOT NULL DEFAULT 0,
  xp_this_week INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  level_name TEXT NOT NULL DEFAULT 'Explorador',
  streak_days INTEGER NOT NULL DEFAULT 0,
  streak_best INTEGER NOT NULL DEFAULT 0,
  last_activity_date TEXT,         -- 'YYYY-MM-DD' en UTC
  weekly_reset_date TEXT,          -- lunes de la semana actual
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  sessions_this_week INTEGER NOT NULL DEFAULT 0,
  exams_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_progression_tenant ON mentoria_student_progression(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_progression_student ON mentoria_student_progression(student_id);

-- Logros desbloqueados por el alumno
CREATE TABLE IF NOT EXISTS mentoria_student_achievements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,           -- clave del logro (ej: 'first_session', 'streak_7')
  achievement_label TEXT NOT NULL,
  achievement_description TEXT NOT NULL,
  achievement_icon TEXT NOT NULL DEFAULT '⭐',
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_mentoria_achievements_student ON mentoria_student_achievements(student_id);

-- Historial de XP por sesión (para trazabilidad y gráficas)
CREATE TABLE IF NOT EXISTS mentoria_xp_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  session_id TEXT,
  reason TEXT NOT NULL,                   -- 'session_complete', 'exam_prep', 'streak_bonus', 'achievement'
  xp_delta INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_xp_events_student ON mentoria_xp_events(student_id);
