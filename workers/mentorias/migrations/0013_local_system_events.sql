-- Mentoría — System Events (observabilidad y logging estructurado)
-- Referenciada por resilience/event-logger.ts, feedback-guarantee.ts y trial-enforcement.ts.
-- Estaba definida en resilience/schema.sql pero no incluida en ninguna migration anterior.

CREATE TABLE IF NOT EXISTS mentoria_system_events (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'error', 'critical')),
  data_json   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_system_events_tenant_severity
  ON mentoria_system_events(tenant_id, severity);

CREATE INDEX IF NOT EXISTS idx_system_events_tenant_type
  ON mentoria_system_events(tenant_id, event_type);

CREATE INDEX IF NOT EXISTS idx_system_events_created_at
  ON mentoria_system_events(created_at);
