-- Technical Supervisor Agent V1: Core Tables
-- Persistencia real para incidentes técnicos y recomendaciones
-- Parte de Campamento Base (control plane)

CREATE TABLE IF NOT EXISTS supervisor_incidents (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  category TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'open',
  correlation_id TEXT,
  affected_service TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS supervisor_recommendations (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  probable_cause TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'later',
  owner_surface TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL,
  FOREIGN KEY (incident_id) REFERENCES supervisor_incidents(id)
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_supervisor_incidents_status
  ON supervisor_incidents(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supervisor_incidents_severity
  ON supervisor_incidents(severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supervisor_incidents_created_at
  ON supervisor_incidents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supervisor_incidents_correlation
  ON supervisor_incidents(correlation_id);

CREATE INDEX IF NOT EXISTS idx_supervisor_recommendations_incident
  ON supervisor_recommendations(incident_id);

CREATE INDEX IF NOT EXISTS idx_supervisor_recommendations_urgency
  ON supervisor_recommendations(urgency);
