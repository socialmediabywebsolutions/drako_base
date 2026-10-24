-- Applies to: SOCIALFLOW_AUTHS_DB (saas_socialflow_auths_prod_db)
CREATE TABLE IF NOT EXISTS socialflow_password_reset_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_sf_prt_token_hash ON socialflow_password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_sf_prt_user_id    ON socialflow_password_reset_tokens(user_id);
