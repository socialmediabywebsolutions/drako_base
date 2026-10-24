-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Prepara (sin activar) el soporte de la segunda app de LinkedIn Developer
-- ("Socialcors Community Management", Client ID 78kxkuoq09u78p, producto
-- Community Management API en review). Columna booleana por cuenta,
-- default false para todas las cuentas existentes y nuevas — se activará
-- cuenta por cuenta cuando LinkedIn apruebe esa app, no antes. Ninguna
-- funcionalidad de Community Management se implementa todavía; esta
-- migración solo deja el campo listo para leer/escribir más adelante.
ALTER TABLE saas_social_accounts ADD COLUMN linkedin_cm_enabled INTEGER NOT NULL DEFAULT 0;
