-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Logging de consumo de IA por tenant (unidades de consumo, sin coste económico) —
-- cubre Mistral (ImageAnalysisAgent, ContentGeneratorAgent vía WorkersAiLocalModel.
-- generateStructured, ver src/lib/socialflow/ai/models/localModel.ts), TTS (Aura-2,
-- ver ReelsAgent.ts::generateNarrationTrackUrl) y el vídeo IA (Apiframe/Kling, ver
-- generateVideoWithApiframe en workers/socialflow-ai-worker/src/index.ts). Independiente
-- de ai_usage_counters (DRACO_DB) — esa tabla es un contador agregado mensual para el
-- flujo principal de Draco; esta es un log fila-a-fila específico de SocialFlow.
CREATE TABLE IF NOT EXISTS socialflow_ai_usage_log (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id         TEXT NOT NULL,
  agent             TEXT NOT NULL, -- ej: ImageAnalysisAgent, ContentGeneratorAgent, TTS, VideoIA
  model             TEXT NOT NULL, -- ej: mistral-small-3.1-24b, aura-2-es, kling-2.6
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  duration_seconds  INTEGER,
  neurons           REAL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_socialflow_ai_usage_log_tenant
  ON socialflow_ai_usage_log (tenant_id, created_at DESC);
