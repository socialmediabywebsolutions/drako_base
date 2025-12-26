CREATE TABLE IF NOT EXISTS drako_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL,
  checksum TEXT,
  source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drako_migrations_applied_at ON drako_migrations(applied_at);
