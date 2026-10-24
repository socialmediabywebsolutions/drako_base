-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Primer paso para que los "cerebros" de cada red social aprendan de forma
-- independiente (ContentFatigueAgent, ViralOpportunityAgent, AudienceInsightAgent
-- hoy mezclan posts/comentarios de Instagram y LinkedIn en la misma señal).
-- Nullable con DEFAULT NULL — las filas históricas (todas anteriores a esta
-- migración) quedan sin red asignada; NULL se trata como "señal agnóstica /
-- desconocida", no como error.
ALTER TABLE socialflow_intelligence_feed ADD COLUMN network TEXT DEFAULT NULL;
