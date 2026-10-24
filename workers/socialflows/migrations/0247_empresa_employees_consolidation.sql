-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Consolida el sistema de empleados: saas_empresa_employees (0204) queda como única
-- fuente de verdad, absorbiendo lo que aportaba el sistema huérfano
-- socialcors_employee_profiles (0246, sin datos): foto de rostro de referencia propia
-- y soft delete en vez de borrado físico (para no perder historial usado en captions).
ALTER TABLE saas_empresa_employees ADD COLUMN face_r2_key TEXT;
ALTER TABLE saas_empresa_employees ADD COLUMN deleted_at TEXT;
