CREATE TABLE IF NOT EXISTS mentoria_notification_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TEXT,
  last_error TEXT,
  message_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  delivered_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (student_id) REFERENCES student_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_tenant_status ON mentoria_notification_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_next_retry ON mentoria_notification_jobs(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_created_at ON mentoria_notification_jobs(created_at);

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

CREATE INDEX IF NOT EXISTS idx_feedback_jobs_tenant_status ON mentoria_feedback_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_feedback_jobs_created_at ON mentoria_feedback_jobs(created_at);

CREATE TABLE IF NOT EXISTS mentoria_publish_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_publish',
  external_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  published_at TEXT,
  confirmed_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (post_id) REFERENCES acquisition_posts(id)
);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_tenant_status ON mentoria_publish_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_external_id ON mentoria_publish_jobs(external_id);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_created_at ON mentoria_publish_jobs(created_at);

CREATE TABLE IF NOT EXISTS mentoria_system_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_system_events_tenant_severity ON mentoria_system_events(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_system_events_tenant_type ON mentoria_system_events(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON mentoria_system_events(created_at);

CREATE TABLE IF NOT EXISTS mentoria_idempotency_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(tenant_id, idempotency_key, operation_type),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_tenant ON mentoria_idempotency_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON mentoria_idempotency_keys(created_at);

CREATE TABLE IF NOT EXISTS mentoria_notification_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  message_id TEXT,
  error_message TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_notification_log_tenant ON mentoria_notification_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_session ON mentoria_notification_log(session_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_status_created_at ON mentoria_notification_log(status, created_at);
