-- 0051_drako_events_rollups.sql
-- Daily rollups + query indexes for campamento_events.

CREATE TABLE IF NOT EXISTS campamento_event_rollups_daily (
  day TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  saas_slug TEXT,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  count INTEGER NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (day, tenant_id, saas_slug, type, severity)
);

CREATE INDEX IF NOT EXISTS idx_campamento_events_tenant_created ON campamento_events (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_campamento_events_tenant_severity_created ON campamento_events (tenant_id, severity, created_at);
CREATE INDEX IF NOT EXISTS idx_campamento_events_tenant_type_created ON campamento_events (tenant_id, type, created_at);
CREATE INDEX IF NOT EXISTS idx_campamento_events_tenant_saas_created ON campamento_events (tenant_id, saas_id, created_at);
