-- 0217_mentoria_guardian_student_links.sql
-- Vinculación entre tutores/familia y alumnos en Mentoría
-- Usa CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS
-- para ser seguro ante tablas preexistentes sin tenant_id

CREATE TABLE IF NOT EXISTS mentoria_guardian_student_links (
  id                 TEXT NOT NULL PRIMARY KEY,
  tenant_id          TEXT NOT NULL DEFAULT '',
  student_profile_id TEXT NOT NULL DEFAULT '',
  guardian_user_id   TEXT,
  guardian_email     TEXT NOT NULL DEFAULT '',
  role               TEXT NOT NULL DEFAULT 'tutor',
  system_role        TEXT NOT NULL DEFAULT 'secondary_guardian',
  status             TEXT NOT NULL DEFAULT 'pending',
  created_at         TEXT NOT NULL DEFAULT '',
  updated_at         TEXT NOT NULL DEFAULT ''
);

-- Añadir columnas que podrían faltar si la tabla ya existía previamente
ALTER TABLE mentoria_guardian_student_links ADD COLUMN IF NOT EXISTS tenant_id          TEXT NOT NULL DEFAULT '';
ALTER TABLE mentoria_guardian_student_links ADD COLUMN IF NOT EXISTS student_profile_id TEXT NOT NULL DEFAULT '';
ALTER TABLE mentoria_guardian_student_links ADD COLUMN IF NOT EXISTS guardian_user_id   TEXT;
ALTER TABLE mentoria_guardian_student_links ADD COLUMN IF NOT EXISTS guardian_email     TEXT NOT NULL DEFAULT '';
ALTER TABLE mentoria_guardian_student_links ADD COLUMN IF NOT EXISTS role               TEXT NOT NULL DEFAULT 'tutor';
ALTER TABLE mentoria_guardian_student_links ADD COLUMN IF NOT EXISTS system_role        TEXT NOT NULL DEFAULT 'secondary_guardian';
ALTER TABLE mentoria_guardian_student_links ADD COLUMN IF NOT EXISTS status             TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE mentoria_guardian_student_links ADD COLUMN IF NOT EXISTS created_at         TEXT NOT NULL DEFAULT '';
ALTER TABLE mentoria_guardian_student_links ADD COLUMN IF NOT EXISTS updated_at         TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_mentoria_gsl_tenant   ON mentoria_guardian_student_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_gsl_student  ON mentoria_guardian_student_links(student_profile_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_gsl_email    ON mentoria_guardian_student_links(guardian_email, tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_gsl_guardian ON mentoria_guardian_student_links(guardian_user_id, tenant_id);
