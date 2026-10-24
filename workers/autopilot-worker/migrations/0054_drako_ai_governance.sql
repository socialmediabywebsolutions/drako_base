CREATE TABLE IF NOT EXISTS ai_usage_counters (
  key TEXT PRIMARY KEY,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  requests_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_rate_limit_buckets (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_circuit_breakers (
  key TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  opened_at TEXT NULL,
  cooldown_until TEXT NULL,
  last_error TEXT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_counters_key ON ai_usage_counters(key);
CREATE INDEX IF NOT EXISTS idx_ai_rate_limit_buckets_window ON ai_rate_limit_buckets(window_start);
CREATE INDEX IF NOT EXISTS idx_ai_circuit_breakers_state ON ai_circuit_breakers(state);
