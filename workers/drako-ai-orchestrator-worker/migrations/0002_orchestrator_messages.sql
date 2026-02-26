-- Chat Orquestador persistence for mensajes y contexto básico
CREATE TABLE IF NOT EXISTS orchestrator_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_orchestrator_messages_thread ON orchestrator_messages(thread_id, created_at);
