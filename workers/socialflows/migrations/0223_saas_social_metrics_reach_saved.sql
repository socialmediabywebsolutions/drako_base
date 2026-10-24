-- Applies to: SOCIAL_DB / SAASES_DB (saas_socialflows_prod_db)
-- reach y saved ya se piden a Meta y se guardan hoy solo dentro de metadata (JSON) —
-- esta migración los promueve a columnas propias para poder consultarlos/reportarlos
-- sin parsear JSON. metrics-collector.ts sigue escribiéndolos también en metadata
-- (sin cambios ahí) para no romper ningún lector existente (ej. AnalyticsMeta en el
-- dashboard); las columnas nuevas son el mecanismo hacia adelante.
ALTER TABLE saas_social_metrics ADD COLUMN reach INTEGER NOT NULL DEFAULT 0;
ALTER TABLE saas_social_metrics ADD COLUMN saved INTEGER NOT NULL DEFAULT 0;
