-- 0217_mentoria_guardian_student_links.sql
-- Vinculación entre tutores/familia y alumnos en Mentoría
-- Permite al mentor asociar emails de familiares a un alumno

CREATE TABLE IF NOT EXISTS mentoria_guardian_student_links (
  id                TEXT    PRIMARY KEY,
  tenant_id         TEXT    NOT NULL,
  student_profile_id TEXT   NOT NULL,   -- mentoria_student_profiles.id
  guardian_user_id  TEXT,               -- mentoria_users.id (NULL si aún no tiene cuenta)
  guardian_email    TEXT    NOT NULL,
  role              TEXT    NOT NULL DEFAULT 'tutor',   -- father | mother | tutor
  system_role       TEXT    NOT NULL DEFAULT 'secondary_guardian',  -- primary_guardian | secondary_guardian
  status            TEXT    NOT NULL DEFAULT 'pending', -- pending | active | removed
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mentoria_gsl_tenant ON mentoria_guardian_student_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_gsl_student ON mentoria_guardian_student_links(student_profile_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_gsl_email ON mentoria_guardian_student_links(guardian_email, tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_gsl_guardian ON mentoria_guardian_student_links(guardian_user_id, tenant_id);
