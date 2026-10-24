-- OAuth state nonces for SocialFlow's signed connect-flow state (Meta, LinkedIn,
-- Instagram). Each nonce is inserted exactly once, at verification time, via
-- INSERT OR IGNORE — a second insert for the same nonce (replay of a captured
-- callback URL) affects 0 rows, which the caller treats as verification failure.
-- provider/tenant_id/saas_id are stored for observability only, not uniqueness
-- (the nonce itself is already globally unique — see signOAuthState in
-- src/lib/socialflow/oauth/state.ts).
CREATE TABLE IF NOT EXISTS socialflow_oauth_state_nonces (
  nonce       TEXT PRIMARY KEY,
  provider    TEXT NOT NULL,
  tenant_id   TEXT NOT NULL,
  saas_id     TEXT NOT NULL,
  issued_at   INTEGER NOT NULL,
  consumed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_socialflow_oauth_state_nonces_issued_at
  ON socialflow_oauth_state_nonces (issued_at);
