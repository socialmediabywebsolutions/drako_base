CREATE TABLE IF NOT EXISTS mentoria_feedback_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  session_count INTEGER NOT NULL,
  liked_json TEXT NOT NULL,
  missing_json TEXT NOT NULL,
  would_recommend INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  stored_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (student_profile_id) REFERENCES student_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_jobs_tenant_status
  ON mentoria_feedback_jobs(tenant_id, status);

CREATE TABLE IF NOT EXISTS mentoria_system_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_system_events_tenant_severity
  ON mentoria_system_events(tenant_id, severity);

CREATE INDEX IF NOT EXISTS idx_system_events_tenant_type
  ON mentoria_system_events(tenant_id, event_type);

CREATE INDEX IF NOT EXISTS idx_system_events_created_at
  ON mentoria_system_events(created_at);
