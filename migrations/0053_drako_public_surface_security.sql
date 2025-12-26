CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_updated_at ON rate_limit_buckets(updated_at);

CREATE TABLE IF NOT EXISTS public_ingest_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NULL,
  token TEXT NULL,
  hmac_secret TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_public_ingest_tokens_tenant_saas
  ON public_ingest_tokens(tenant_id, saas_id);
