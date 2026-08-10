-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Real Video Generation (HappyHorse 1.0 I2V, alibaba/hh1-i2v) — job tracking table.
-- Written by /api/socialflow/reels/generate-ai-video (status 'pending' + enqueue) and
-- workers/socialflow-ai-worker/src/index.ts's queue() consumer (status transitions
-- pending -> processing -> completed/failed), read by
-- /api/socialflow/reels/ai-video-status/[jobId] for the client's polling loop. Video
-- generation runs in a dedicated worker, not the main request/response cycle — see the
-- comment at the top of socialflow-ai-worker/src/index.ts for why (HTTP response time
-- limit).
CREATE TABLE IF NOT EXISTS socialflow_ai_video_jobs (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id     TEXT NOT NULL,
  saas_id       TEXT NOT NULL,
  image_url     TEXT NOT NULL,
  prompt        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
  video_url     TEXT,
  error         TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_socialflow_ai_video_jobs_tenant
  ON socialflow_ai_video_jobs (tenant_id, saas_id, created_at DESC);
