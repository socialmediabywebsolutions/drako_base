-- P2 INTELLIGENT SUMMARIES: IA-generated summaries for parents
-- Tabla central de resúmenes automáticos

CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  family_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (family_id) REFERENCES families(id)
);

CREATE INDEX IF NOT EXISTS idx_summaries_student_id ON summaries(student_id);
CREATE INDEX IF NOT EXISTS idx_summaries_family_id ON summaries(family_id);
CREATE INDEX IF NOT EXISTS idx_summaries_type ON summaries(type);
CREATE INDEX IF NOT EXISTS idx_summaries_created_at ON summaries(created_at);

-- Tabla de análisis de eventos (para tracking de qué eventos se usaron)
CREATE TABLE IF NOT EXISTS event_analyses (
  id TEXT PRIMARY KEY,
  summary_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (summary_id) REFERENCES summaries(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX IF NOT EXISTS idx_event_analyses_summary_id ON event_analyses(summary_id);
CREATE INDEX IF NOT EXISTS idx_event_analyses_event_id ON event_analyses(event_id);
