-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Perfiles de empleados para cuentas empresa — equivalente a socialcors_physical_profile
-- pero para negocios, no influencers: foto de rostro de referencia por empleado para que
-- la IA reconozca quién aparece en las fotos y genere captions/contexto de imagen contextual.
CREATE TABLE IF NOT EXISTS socialcors_employee_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  job_description TEXT,
  face_r2_key TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_socialcors_employee_profiles_tenant ON socialcors_employee_profiles (tenant_id, is_active);
