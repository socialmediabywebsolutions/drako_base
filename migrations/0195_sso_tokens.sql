-- 0195_sso_tokens.sql
-- One-time tokens for SSO handoff from Campamento Base to SocialFlow.
-- Stored in DRACO_DB (accessible from both workers).
-- Each token is single-use and expires after 60 seconds.

CREATE TABLE IF NOT EXISTS sso_tokens (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user',
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_sso_tokens_expires_at ON sso_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_sso_tokens_tenant_id  ON sso_tokens(tenant_id);
