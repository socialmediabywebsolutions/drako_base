-- 0219_mentoria_family_auth_tables.sql
-- Tablas necesarias para el registro y autenticación de familias en MENTORIA_DB
-- Estas tablas son usadas por MentoriaFamilyRepository
-- NOTA: D1 no soporta ALTER TABLE ADD COLUMN IF NOT EXISTS.
-- Las columnas se añaden previamente en el workflow con || true antes de ejecutar este archivo.

-- Tenants (familias como tenants)
CREATE TABLE IF NOT EXISTS tenants (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'starter',
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- Families (unidad familiar)
CREATE TABLE IF NOT EXISTS families (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Guardians (padres/tutores vinculados a una familia)
CREATE TABLE IF NOT EXISTS guardians (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL,
  name             TEXT,
  family_id        TEXT NOT NULL,
  role             TEXT CHECK(role IN ('father','mother','tutor')),
  system_role      TEXT NOT NULL DEFAULT 'secondary_guardian',
  family_relation  TEXT,
  tenant_id        TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_guardians_family_id ON guardians(family_id);
CREATE INDEX IF NOT EXISTS idx_guardians_email ON guardians(email);
CREATE INDEX IF NOT EXISTS idx_guardians_tenant_id ON guardians(tenant_id);

-- Students (alumnos en el contexto de familia)
CREATE TABLE IF NOT EXISTS students (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  age         INTEGER,
  level       TEXT,
  family_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_students_family_id ON students(family_id);

-- Guardian student access (permisos de acceso de guardián a alumno)
CREATE TABLE IF NOT EXISTS guardian_student_access (
  id                              TEXT PRIMARY KEY,
  family_id                       TEXT NOT NULL,
  guardian_id                     TEXT NOT NULL,
  student_id                      TEXT NOT NULL,
  student_profile_id              TEXT,
  can_view_full_progress          INTEGER NOT NULL DEFAULT 1,
  can_manage_schedule             INTEGER NOT NULL DEFAULT 0,
  daily_study_minutes             INTEGER,
  supervision_level               TEXT DEFAULT 'balanced',
  notification_preferences_json   TEXT DEFAULT '[]',
  is_primary_contact              INTEGER NOT NULL DEFAULT 0,
  created_at                      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at                      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_gsa_family ON guardian_student_access(family_id);
CREATE INDEX IF NOT EXISTS idx_gsa_guardian ON guardian_student_access(guardian_id);
CREATE INDEX IF NOT EXISTS idx_gsa_student ON guardian_student_access(student_id);
