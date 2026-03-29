-- Mentoria Session Persistence Table
-- Stores continuous session state snapshots for recovery

CREATE TABLE IF NOT EXISTS mentoria_session_state (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  transcript_json TEXT NOT NULL DEFAULT '[]',
  emotional_state TEXT NOT NULL DEFAULT 'neutral',
  last_activity_at TEXT NOT NULL,
  ai_tokens_used INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, session_id),
  FOREIGN KEY(tenant_id) REFERENCES tenants(id),
  FOREIGN KEY(student_profile_id) REFERENCES student_profiles(id)
);

-- Index for active session recovery
CREATE INDEX IF NOT EXISTS idx_mentoria_session_state_active
  ON mentoria_session_state(tenant_id, student_profile_id, status, last_activity_at DESC)
  WHERE status = 'active';

-- Index for session lookup
CREATE INDEX IF NOT EXISTS idx_mentoria_session_state_lookup
  ON mentoria_session_state(tenant_id, session_id);
