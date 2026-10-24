-- Actividad de publicación de posts (P5 del plan de independencia de SocialCors).
-- Sustituye a las filas que live-publishing escribía en DRACO_DB.drako_observability_activities
-- (observability-core del holding). Ahora la escriben los dos Workers de SocialCors
-- (web e IA); antes el Worker IA las perdía porque no tiene DRACO_DB.
-- Lectura: src/lib/socialflow/publish-activity.ts (contrato de observabilidad del operator).
CREATE TABLE IF NOT EXISTS socialflow_publish_activity (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  post_id       TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('info', 'success', 'error')),
  summary       TEXT NOT NULL,
  metadata      TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_socialflow_publish_activity_tenant
  ON socialflow_publish_activity (tenant_id, saas_id, created_at);

CREATE INDEX IF NOT EXISTS idx_socialflow_publish_activity_post
  ON socialflow_publish_activity (post_id, created_at);
