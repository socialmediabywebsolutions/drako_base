-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — tracks whether a post was created via the AI auto pipeline
-- (SocialFlowOrchestrator, botón central "modo automático") or manually through the
-- vertical menu (Post/Reel/Historia/Carrusel), so the calendar can show an AUTO/MANUAL
-- badge on each card. DEFAULT 'AUTO' so existing rows — all created by the orchestrator
-- before this column existed — classify correctly without a backfill.
ALTER TABLE saas_social_posts ADD COLUMN creation_mode TEXT NOT NULL DEFAULT 'AUTO';
