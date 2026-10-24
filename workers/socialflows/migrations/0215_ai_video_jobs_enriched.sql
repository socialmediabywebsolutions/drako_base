-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Rediseño del flujo de Vídeo IA (Real Video Generation, alibaba/hh1-i2v) — el job ya no
-- solo guarda el video_url final, sino todo lo que produce el pipeline enriquecido del
-- consumer (workers/socialflow-ai-worker/src/index.ts): caption + hashtags reales
-- (ContentGeneratorAgent, mismo pipeline que Posts/Reels normales), narración de voz
-- (TTS @cf/deepgram/aura-2-es) y una hora sugerida para programar. animation_prompt es
-- el prompt en inglés que Mistral generó para hh1-i2v a partir del análisis de imagen —
-- se guarda solo para debug/auditoría, nunca se muestra al cliente.
ALTER TABLE socialflow_ai_video_jobs ADD COLUMN caption TEXT;
ALTER TABLE socialflow_ai_video_jobs ADD COLUMN hashtags TEXT;
ALTER TABLE socialflow_ai_video_jobs ADD COLUMN narration_url TEXT;
ALTER TABLE socialflow_ai_video_jobs ADD COLUMN suggested_scheduled_at TEXT;
ALTER TABLE socialflow_ai_video_jobs ADD COLUMN animation_prompt TEXT;
