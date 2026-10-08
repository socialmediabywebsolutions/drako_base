-- 0217_mentoria_guardian_student_links.sql
-- Vinculación entre tutores/familia y alumnos en Mentoría
-- NOTA: D1 no soporta ALTER TABLE ADD COLUMN IF NOT EXISTS.
-- Las columnas se añaden previamente en el workflow con || true antes de ejecutar este archivo.

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

CREATE INDEX IF NOT EXISTS idx_mentoria_gsl_tenant   ON mentoria_guardian_student_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_gsl_student  ON mentoria_guardian_student_links(student_profile_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_gsl_email    ON mentoria_guardian_student_links(guardian_email, tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_gsl_guardian ON mentoria_guardian_student_links(guardian_user_id, tenant_id);
