-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Añade zona/tarifa (texto libre, declarado por el cliente, mismo criterio que
-- description/category en esta tabla) y credential_declared/credential_description
-- (modelo "declarado" — no existe motor de verificación por documento en el repo hoy,
-- ver auditoría) a saas_empresa_services. No se replica en ensureSocialSchema
-- (repository.ts): esta tabla nunca se añadió ahí, vive solo vía migraciones.
ALTER TABLE saas_empresa_services ADD COLUMN zona TEXT;
ALTER TABLE saas_empresa_services ADD COLUMN tarifa TEXT;
ALTER TABLE saas_empresa_services ADD COLUMN credential_declared INTEGER NOT NULL DEFAULT 0;
ALTER TABLE saas_empresa_services ADD COLUMN credential_description TEXT;
