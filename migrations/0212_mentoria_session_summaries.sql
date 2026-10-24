-- Mentoría — Resúmenes de sesión automáticos
-- Generados al terminar cada sesión de estudio.
-- Contienen el titular, puntos clave de lo aprendido y mensaje de cierre.
-- Tenant-isolated: tenant_id + student_id en todos los índices.

CREATE TABLE IF NOT EXISTS mentoria_session_summaries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  subject_slug TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  session_date TEXT NOT NULL,           -- ISO 8601
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  headline TEXT NOT NULL,               -- Titular de la sesión ("Entendiste las fracciones")
  points_json TEXT NOT NULL DEFAULT '[]', -- JSON array de SessionSummaryPoint
  closing_tone TEXT NOT NULL DEFAULT 'neutral' CHECK (closing_tone IN ('positive', 'neutral', 'needs_encouragement')),
  closing_message TEXT NOT NULL,
  parent_note TEXT,                     -- Solo si hay algo relevante para el padre
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Índice principal: resúmenes del alumno ordenados por fecha
CREATE INDEX IF NOT EXISTS idx_mentoria_summaries_student
  ON mentoria_session_summaries (tenant_id, student_id, session_date DESC);

-- Índice por materia: para mostrar historial por asignatura en el dashboard
CREATE INDEX IF NOT EXISTS idx_mentoria_summaries_subject
  ON mentoria_session_summaries (tenant_id, student_id, subject_slug, session_date DESC);
