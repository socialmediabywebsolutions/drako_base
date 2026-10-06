-- Mentoría — Adquisición: publicaciones sociales y programación de contenido
-- Habilita el seguimiento de posts de adquisición y conversiones (clics, signups, trials).

CREATE TABLE IF NOT EXISTS acquisition_posts (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  post_id     TEXT NOT NULL,
  channel     TEXT NOT NULL CHECK(channel IN ('linkedin', 'instagram', 'tiktok')),
  content     TEXT NOT NULL,
  published_at TEXT NOT NULL,
  external_id TEXT,
  clicks      INTEGER NOT NULL DEFAULT 0,
  signups     INTEGER NOT NULL DEFAULT 0,
  trial_starts INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_acquisition_posts_tenant
  ON acquisition_posts(tenant_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_acquisition_posts_channel
  ON acquisition_posts(tenant_id, channel, published_at DESC);

-- Programación de contenido de adquisición
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  post_id      TEXT NOT NULL,
  channel      TEXT NOT NULL CHECK(channel IN ('linkedin', 'instagram', 'tiktok')),
  content      TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'published', 'failed')),
  published_at TEXT,
  error        TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_tenant_status
  ON scheduled_posts(tenant_id, status, scheduled_for ASC);
