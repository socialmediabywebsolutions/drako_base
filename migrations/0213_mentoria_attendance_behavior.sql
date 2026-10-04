-- Asistencia y comportamiento del alumno en el colegio
-- Introducido por padres/tutores desde el panel familiar

CREATE TABLE IF NOT EXISTS mentoria_attendance_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  record_date TEXT NOT NULL,                          -- YYYY-MM-DD
  subject_slug TEXT,                                  -- null = día completo
  status TEXT NOT NULL CHECK (status IN (
    'present',          -- asistió
    'absent_justified', -- falta justificada
    'absent',           -- falta sin justificar
    'late',             -- llegó tarde
    'left_early'        -- salió antes
  )),
  notes TEXT,
  created_by_actor_type TEXT NOT NULL DEFAULT 'guardian',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_attendance_student
  ON mentoria_attendance_records (tenant_id, student_profile_id, record_date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_attendance_day_subject
  ON mentoria_attendance_records (tenant_id, student_profile_id, record_date, COALESCE(subject_slug, ''));

-- Notas de comportamiento en clase (puestas por padres desde lo que les cuenta el profe)
CREATE TABLE IF NOT EXISTS mentoria_behavior_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  record_date TEXT NOT NULL,                          -- YYYY-MM-DD
  subject_slug TEXT,                                  -- null = general
  behavior_type TEXT NOT NULL CHECK (behavior_type IN (
    'positive',         -- participación, esfuerzo, actitud
    'neutral',          -- sin incidencias
    'attention',        -- necesita más atención
    'disruptive',       -- conducta disruptiva
    'disengaged'        -- desconectado, ausente mentalmente
  )),
  intensity INTEGER NOT NULL DEFAULT 2 CHECK (intensity BETWEEN 1 AND 5),  -- 1=leve 5=muy marcado
  note TEXT,
  source TEXT NOT NULL DEFAULT 'parent_report' CHECK (source IN (
    'parent_report',    -- el padre lo introduce
    'teacher_note',     -- nota del profe que comparte el padre
    'ai_detected'       -- detectado por el agente en sesión
  )),
  created_by_actor_type TEXT NOT NULL DEFAULT 'guardian',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_behavior_student
  ON mentoria_behavior_records (tenant_id, student_profile_id, record_date DESC);

-- Preferencias de materias detectadas por el agente IA durante las sesiones
CREATE TABLE IF NOT EXISTS mentoria_subject_preferences (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_slug TEXT NOT NULL,
  preference_score REAL NOT NULL DEFAULT 0.5,  -- 0=odia 0.5=neutral 1=le encanta
  engagement_score REAL NOT NULL DEFAULT 0.5,  -- implicación durante sesiones
  frustration_score REAL NOT NULL DEFAULT 0.0, -- frustración detectada
  last_detected_mood TEXT,                     -- animado|neutro|desanimado|bloqueado
  sessions_analyzed INTEGER NOT NULL DEFAULT 0,
  detected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_subject_preferences_unique
  ON mentoria_subject_preferences (tenant_id, student_profile_id, subject_slug);
