-- Steel v1.0.1 - Step 4: Idempotency Tracking

CREATE TABLE IF NOT EXISTS processed_jobs (
  idempotency_key TEXT PRIMARY KEY,
  status TEXT NOT NULL, -- 'COMPLETED', 'FAILED'
  result_metadata TEXT,
  correlation_id TEXT,
  created_at TEXT NOT NULL,
  processed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processed_jobs_correlation ON processed_jobs(correlation_id);
