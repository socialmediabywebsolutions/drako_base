-- Add planned format-mix counters to saas_social_campaigns.
--
-- post_count / reel_count / historia_count hold the number of each content
-- format planned for a campaign (Fase 1 of the "mezcla de formatos" feature —
-- see AUDITORIA de esta sesión). Populating/using these columns is Fase 2+
-- (wizard UI, auto-detection on upload); this migration only adds storage.
--
-- DEFAULT 0 on all three keeps every existing campaign row valid without a
-- backfill step — an existing campaign simply has no planned mix yet.

ALTER TABLE saas_social_campaigns ADD COLUMN post_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE saas_social_campaigns ADD COLUMN reel_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE saas_social_campaigns ADD COLUMN historia_count INTEGER NOT NULL DEFAULT 0;
