CREATE TABLE IF NOT EXISTS leads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre     TEXT    NOT NULL,
  email      TEXT    NOT NULL,
  motivo     TEXT    NOT NULL,
  mensaje    TEXT    DEFAULT '',
  created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_email   ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_motivo  ON leads(motivo);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
