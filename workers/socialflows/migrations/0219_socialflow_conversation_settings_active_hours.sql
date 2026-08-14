-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Horario configurable para el Agente de Comunidad — único gap real identificado en
-- la auditoría de Comunidad (auditoria-comunidad.md, sección 5). Nullable con DEFAULT
-- NULL: sin configurar, el comportamiento es idéntico al actual (responde 24/7,
-- sin ningún gate de horario). El JSON completo (enabled, timezone, schedule por día,
-- outside_hours_message) se valida/interpreta en aplicación, no en SQL.
ALTER TABLE socialflow_conversation_settings ADD COLUMN active_hours_json TEXT DEFAULT NULL;
