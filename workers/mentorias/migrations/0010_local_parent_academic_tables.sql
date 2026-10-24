-- Mentoría — Tablas académicas, asistencia, comportamiento y flujo de material WhatsApp
-- Habilita el dashboard de padres, registro académico, ingesta de material vía WhatsApp
-- y snapshots de rendimiento por materia.

-- ─── Material Intake (WhatsApp) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentoria_material_intakes (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  student_profile_id  TEXT NOT NULL,
  channel             TEXT NOT NULL DEFAULT 'whatsapp',
  source_message_id   TEXT NOT NULL UNIQUE,
  phone_number        TEXT NOT NULL,
  media_type          TEXT NOT NULL CHECK(media_type IN ('image', 'document')),
  intake_kind         TEXT NOT NULL,
  provider_media_id   TEXT NOT NULL,
  mime_type           TEXT NOT NULL,
  file_name           TEXT,
  caption             TEXT,
  original_text       TEXT,
  status              TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received', 'processing', 'processed', 'failed')),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_material_intakes_tenant_student
  ON mentoria_material_intakes(tenant_id, student_profile_id, created_at DESC);

-- ─── Material Context Notes (texto contextual enviado tras la imagen/PDF) ─────
CREATE TABLE IF NOT EXISTS mentoria_material_context_notes (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  student_profile_id  TEXT NOT NULL,
  material_intake_id  TEXT NOT NULL,
  source_message_id   TEXT NOT NULL UNIQUE,
  body                TEXT NOT NULL,
  created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_material_context_notes_intake
  ON mentoria_material_context_notes(tenant_id, material_intake_id);

-- ─── Academic Records (notas, exámenes, tareas) ───────────────────────────────
CREATE TABLE IF NOT EXISTS mentoria_academic_records (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  student_profile_id    TEXT NOT NULL,
  subject_slug          TEXT,
  record_type           TEXT NOT NULL,
  source_channel        TEXT NOT NULL DEFAULT 'manual_web',
  source_ref_id         TEXT NOT NULL,
  title                 TEXT NOT NULL,
  score_value           REAL,
  score_scale           REAL,
  score_label           TEXT,
  recorded_at           TEXT NOT NULL,
  teacher_comment       TEXT,
  status                TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('provisional', 'confirmed', 'disputed', 'archived')),
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id   TEXT,
  metadata_json         TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academic_records_tenant_student
  ON mentoria_academic_records(tenant_id, student_profile_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_academic_records_subject
  ON mentoria_academic_records(tenant_id, student_profile_id, subject_slug, recorded_at DESC);

-- ─── Academic Documents (imágenes/PDFs de documentos académicos) ──────────────
CREATE TABLE IF NOT EXISTS mentoria_academic_documents (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  student_profile_id  TEXT NOT NULL,
  academic_record_id  TEXT,
  material_intake_id  TEXT,
  subject_slug        TEXT,
  document_kind       TEXT NOT NULL,
  classification      TEXT NOT NULL,
  source_channel      TEXT NOT NULL,
  source_message_id   TEXT UNIQUE,
  storage_key         TEXT NOT NULL,
  mime_type           TEXT NOT NULL,
  file_name           TEXT,
  sha256              TEXT,
  captured_at         TEXT NOT NULL,
  notes_text          TEXT,
  analysis_status     TEXT NOT NULL DEFAULT 'pending' CHECK(analysis_status IN ('pending', 'processing', 'done', 'failed', 'skipped')),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academic_documents_tenant_student
  ON mentoria_academic_documents(tenant_id, student_profile_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_academic_documents_status
  ON mentoria_academic_documents(tenant_id, analysis_status, captured_at DESC);

-- ─── Academic Extractions (datos extraídos por IA de documentos) ──────────────
CREATE TABLE IF NOT EXISTS mentoria_academic_extractions (
  id                        TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL,
  student_profile_id        TEXT NOT NULL,
  document_id               TEXT NOT NULL,
  academic_record_id        TEXT,
  subject_slug              TEXT,
  extracted_record_type     TEXT,
  extracted_score_value     REAL,
  extracted_score_scale     REAL,
  extracted_score_label     TEXT,
  extracted_teacher_comment TEXT,
  extracted_exam_date       TEXT,
  confidence_score          REAL NOT NULL DEFAULT 0,
  status                    TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'rejected')),
  raw_json                  TEXT,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academic_extractions_document
  ON mentoria_academic_extractions(tenant_id, document_id);

-- ─── Academic Analyses (análisis de errores y puntos débiles por IA) ──────────
CREATE TABLE IF NOT EXISTS mentoria_academic_analyses (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  student_profile_id  TEXT NOT NULL,
  academic_record_id  TEXT NOT NULL,
  document_id         TEXT,
  subject_slug        TEXT,
  analysis_type       TEXT NOT NULL,
  mistakes_json       TEXT,
  weak_points_json    TEXT,
  strong_points_json  TEXT,
  recommendations_json TEXT,
  board_signal_json   TEXT,
  confidence_score    REAL NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academic_analyses_record
  ON mentoria_academic_analyses(tenant_id, academic_record_id);

CREATE INDEX IF NOT EXISTS idx_academic_analyses_student
  ON mentoria_academic_analyses(tenant_id, student_profile_id, created_at DESC);

-- ─── Subject Performance Snapshots (resúmenes periódicos por materia) ─────────
CREATE TABLE IF NOT EXISTS mentoria_subject_performance_snapshots (
  id                        TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL,
  student_profile_id        TEXT NOT NULL,
  subject_slug              TEXT NOT NULL,
  snapshot_date             TEXT NOT NULL,
  school_average_score      REAL,
  mentoria_mastery_score    REAL,
  mentoria_confidence_score REAL,
  trend_direction           TEXT NOT NULL DEFAULT 'unknown' CHECK(trend_direction IN ('up', 'down', 'steady', 'unknown')),
  weak_points_json          TEXT,
  strong_points_json        TEXT,
  notes_count               INTEGER NOT NULL DEFAULT 0,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subject_snapshots_student
  ON mentoria_subject_performance_snapshots(tenant_id, student_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subject_snapshots_subject
  ON mentoria_subject_performance_snapshots(tenant_id, student_profile_id, subject_slug, snapshot_date DESC);

-- ─── Subject Preferences (preferencias detectadas por IA) ────────────────────
CREATE TABLE IF NOT EXISTS mentoria_subject_preferences (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  student_profile_id  TEXT NOT NULL,
  subject_slug        TEXT NOT NULL,
  preference_score    REAL NOT NULL DEFAULT 0.5,
  engagement_score    REAL NOT NULL DEFAULT 0.5,
  frustration_score   REAL NOT NULL DEFAULT 0,
  last_detected_mood  TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  UNIQUE(tenant_id, student_profile_id, subject_slug)
);

CREATE INDEX IF NOT EXISTS idx_subject_preferences_student
  ON mentoria_subject_preferences(tenant_id, student_profile_id);

-- ─── Attendance Records (asistencia) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentoria_attendance_records (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  student_profile_id    TEXT NOT NULL,
  record_date           TEXT NOT NULL,
  subject_slug          TEXT,
  status                TEXT NOT NULL CHECK(status IN ('present', 'absent', 'absent_justified', 'late')),
  notes                 TEXT,
  created_by_actor_type TEXT NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Expression-based unique index to handle nullable subject_slug (COALESCE replaces NULL with '')
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_day
  ON mentoria_attendance_records(tenant_id, student_profile_id, record_date, COALESCE(subject_slug, ''));

CREATE INDEX IF NOT EXISTS idx_attendance_records_student
  ON mentoria_attendance_records(tenant_id, student_profile_id, record_date DESC);

-- ─── Behavior Records (comportamiento reportado por padres/profesores) ─────────
CREATE TABLE IF NOT EXISTS mentoria_behavior_records (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  student_profile_id    TEXT NOT NULL,
  record_date           TEXT NOT NULL,
  subject_slug          TEXT,
  behavior_type         TEXT NOT NULL CHECK(behavior_type IN ('positive', 'neutral', 'attention', 'disruptive', 'disengaged')),
  intensity             INTEGER NOT NULL DEFAULT 2 CHECK(intensity BETWEEN 1 AND 5),
  note                  TEXT,
  source                TEXT NOT NULL DEFAULT 'parent_report',
  created_by_actor_type TEXT NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_behavior_records_student
  ON mentoria_behavior_records(tenant_id, student_profile_id, record_date DESC);
