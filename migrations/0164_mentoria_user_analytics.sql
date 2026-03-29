-- Mentoria User Analytics
-- Tracks user behavior metrics for conversion and optimization

CREATE TABLE IF NOT EXISTS user_behavior_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  signup_at TEXT NOT NULL,
  first_session_at TEXT,
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  last_session_at TEXT,
  trial_started_at TEXT NOT NULL,
  trial_expires_at TEXT NOT NULL,
  trial_converted_at TEXT,
  last_activity_at TEXT NOT NULL,
  days_active INTEGER NOT NULL DEFAULT 0,
  engagement_score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, student_profile_id),
  FOREIGN KEY(tenant_id) REFERENCES tenants(id),
  FOREIGN KEY(student_profile_id) REFERENCES student_profiles(id)
);

-- Index for conversion analysis
CREATE INDEX IF NOT EXISTS idx_user_behavior_conversion
  ON user_behavior_metrics(trial_converted_at, first_session_at);

-- Index for engagement tracking
CREATE INDEX IF NOT EXISTS idx_user_behavior_engagement
  ON user_behavior_metrics(engagement_score, sessions_completed);
