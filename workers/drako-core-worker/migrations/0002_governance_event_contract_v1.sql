PRAGMA foreign_keys = ON;

ALTER TABLE governance_events ADD COLUMN schema_version TEXT NOT NULL DEFAULT 'v1' CHECK (schema_version IN ('v1'));
ALTER TABLE governance_events ADD COLUMN trace_id TEXT;
ALTER TABLE governance_events ADD COLUMN actor_type TEXT NOT NULL DEFAULT 'system';
ALTER TABLE governance_events ADD COLUMN occurred_at TEXT;
ALTER TABLE governance_events ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}';
ALTER TABLE governance_events ADD COLUMN source TEXT;
ALTER TABLE governance_events ADD COLUMN severity TEXT CHECK (severity IN ('info', 'warn', 'error', 'critical'));
ALTER TABLE governance_events ADD COLUMN event_json TEXT NOT NULL DEFAULT '{}';

UPDATE governance_events
SET
  schema_version = 'v1',
  trace_id = COALESCE(trace_id, event_id),
  actor_type = COALESCE(actor_type, 'system'),
  occurred_at = COALESCE(occurred_at, created_at),
  metadata = CASE
    WHEN metadata IS NULL OR trim(metadata) = '' THEN '{}'
    ELSE metadata
  END,
  source = COALESCE(source, source_name),
  severity = CASE
    WHEN severity = 'warn' THEN 'warn'
    WHEN severity_name = 'warning' THEN 'warn'
    WHEN severity_name IN ('info', 'error', 'critical') THEN severity_name
    ELSE 'info'
  END,
  event_json = CASE
    WHEN event_json IS NULL OR trim(event_json) = '' THEN
      json_object(
        'event_id', event_id,
        'event_type', event_type,
        'source', COALESCE(source, source_name),
        'saas_slug', saas_slug,
        'tenant_id', tenant_id,
        'actor_type', COALESCE(actor_type, 'system'),
        'actor_id', COALESCE(actor_id, 'system'),
        'severity', CASE
          WHEN severity = 'warn' THEN 'warn'
          WHEN severity_name = 'warning' THEN 'warn'
          WHEN severity_name IN ('info', 'error', 'critical') THEN severity_name
          ELSE 'info'
        END,
        'occurred_at', COALESCE(occurred_at, created_at),
        'metadata', json(CASE
          WHEN metadata IS NULL OR trim(metadata) = '' THEN '{}'
          ELSE metadata
        END),
        'trace_id', COALESCE(trace_id, event_id),
        'correlation_id', COALESCE(correlation_id, trace_id, event_id),
        'schema_version', 'v1'
      )
    ELSE event_json
  END;

UPDATE governance_events
SET occurred_at = created_at
WHERE occurred_at IS NULL OR trim(occurred_at) = '';

UPDATE governance_events
SET source = source_name
WHERE source IS NULL OR trim(source) = '';

UPDATE governance_events
SET severity = 'info'
WHERE severity IS NULL OR trim(severity) = '';

UPDATE governance_events
SET trace_id = event_id
WHERE trace_id IS NULL OR trim(trace_id) = '';

CREATE INDEX IF NOT EXISTS idx_governance_events_trace_id
  ON governance_events(trace_id);

CREATE INDEX IF NOT EXISTS idx_governance_events_correlation_id
  ON governance_events(correlation_id);

CREATE INDEX IF NOT EXISTS idx_governance_events_occurred_at
  ON governance_events(occurred_at);

CREATE INDEX IF NOT EXISTS idx_governance_events_schema_version
  ON governance_events(schema_version);
