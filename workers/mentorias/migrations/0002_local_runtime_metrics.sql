CREATE TABLE IF NOT EXISTS drako_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drako_events_user_created
  ON drako_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_drako_events_type_created
  ON drako_events(type, created_at DESC);
