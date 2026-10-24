-- Mentoría — Columnas faltantes en mentoria_sessions
-- Añade student_id, subject_slug, started_at, ended_at, duration_seconds y xp_earned
-- para habilitar los queries del dashboard de operador y del detalle individual de alumno.
-- Usa ALTER TABLE ... ADD COLUMN IF NOT EXISTS (SQLite 3.37+, compatible con D1).

-- student_id: alias limpio del student_profile_id para joins con mentoria_students
ALTER TABLE mentoria_sessions ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE mentoria_sessions ADD COLUMN IF NOT EXISTS subject_slug TEXT;
ALTER TABLE mentoria_sessions ADD COLUMN IF NOT EXISTS started_at TEXT;
ALTER TABLE mentoria_sessions ADD COLUMN IF NOT EXISTS ended_at TEXT;
ALTER TABLE mentoria_sessions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE mentoria_sessions ADD COLUMN IF NOT EXISTS xp_earned INTEGER NOT NULL DEFAULT 0;

-- Rellenar student_id con student_profile_id para filas existentes
UPDATE mentoria_sessions SET student_id = student_profile_id WHERE student_id IS NULL;

-- Rellenar started_at con created_at para filas sin started_at
UPDATE mentoria_sessions SET started_at = created_at WHERE started_at IS NULL;

-- subject_slug desde subject_id si existe (simple fallback)
UPDATE mentoria_sessions SET subject_slug = subject_id WHERE subject_slug IS NULL AND subject_id IS NOT NULL;

-- Índices para los queries del dashboard de operador
CREATE INDEX IF NOT EXISTS idx_mentoria_sessions_student_id
  ON mentoria_sessions(tenant_id, student_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_mentoria_sessions_started_at
  ON mentoria_sessions(tenant_id, started_at DESC);
