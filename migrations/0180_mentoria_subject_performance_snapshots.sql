CREATE TABLE IF NOT EXISTS mentoria_subject_performance_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_slug TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  school_average_score REAL,
  mentoria_mastery_score REAL,
  mentoria_confidence_score REAL,
  trend_direction TEXT NOT NULL CHECK (trend_direction IN ('up', 'down', 'steady', 'unknown')),
  weak_points_json TEXT NOT NULL DEFAULT '[]',
  strong_points_json TEXT NOT NULL DEFAULT '[]',
  notes_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_subject_performance_snapshots_student
  ON mentoria_subject_performance_snapshots (tenant_id, student_profile_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_mentoria_subject_performance_snapshots_subject
  ON mentoria_subject_performance_snapshots (tenant_id, student_profile_id, subject_slug, snapshot_date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_subject_performance_snapshots_subject_unique
  ON mentoria_subject_performance_snapshots (tenant_id, student_profile_id, subject_slug);
