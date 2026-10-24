-- DevArchitect alerts metadata and linkage
ALTER TABLE alerts ADD COLUMN status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE alerts ADD COLUMN resolved_at TEXT;
ALTER TABLE alerts ADD COLUMN devarchitect_project_id TEXT;
ALTER TABLE alerts ADD COLUMN metadata TEXT;
CREATE INDEX IF NOT EXISTS idx_alerts_devarchitect_project ON alerts(devarchitect_project_id, status);
