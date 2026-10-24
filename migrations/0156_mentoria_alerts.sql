-- P3 INTELLIGENT ALERTS: Automatic problem detection
-- Tabla central de alertas inteligentes

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  family_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  resolved BOOLEAN DEFAULT 0,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (family_id) REFERENCES families(id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_student_id ON alerts(student_id);
CREATE INDEX IF NOT EXISTS idx_alerts_family_id ON alerts(family_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);

-- Tabla de análisis de alertas (para tracking de qué eventos generaron alerta)
CREATE TABLE IF NOT EXISTS alert_analyses (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  metric_name TEXT,
  metric_value REAL,
  threshold REAL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (alert_id) REFERENCES alerts(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX IF NOT EXISTS idx_alert_analyses_alert_id ON alert_analyses(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_analyses_event_id ON alert_analyses(event_id);
