-- Add planned carousel counter to saas_social_campaigns (Fase 5 — Carrusel en Campañas).
--
-- carousel_count sigue el mismo patrón de "mezcla de formatos planeada" que
-- post_count/reel_count/historia_count (migrations/0200_saas_social_campaigns_format_mix.sql).
-- A diferencia de esos tres, un carrusel mapea a N fotos agrupadas en UN post, no una
-- foto por post — ver pickContentTypeFromMix en campaigns/[id]/photos/route.ts.
--
-- DEFAULT 0 mantiene cada campaña existente válida sin necesidad de backfill.

ALTER TABLE saas_social_campaigns ADD COLUMN carousel_count INTEGER NOT NULL DEFAULT 0;
