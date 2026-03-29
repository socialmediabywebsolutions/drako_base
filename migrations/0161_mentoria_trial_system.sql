-- Mentoria Trial System
-- Manages 7-day free trial for new students

CREATE TABLE IF NOT EXISTS student_trials (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  converted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, student_profile_id),
  FOREIGN KEY(tenant_id) REFERENCES tenants(id),
  FOREIGN KEY(student_profile_id) REFERENCES student_profiles(id)
);

-- Index for trial status queries
CREATE INDEX IF NOT EXISTS idx_student_trials_status
  ON student_trials(tenant_id, student_profile_id, status);

-- Index for expiration checks
CREATE INDEX IF NOT EXISTS idx_student_trials_expiry
  ON student_trials(expires_at, status)
  WHERE status = 'active';
