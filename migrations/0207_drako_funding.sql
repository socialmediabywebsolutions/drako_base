-- Oportunidades de financiación del Agente de Financiación (DRACO_DB). Solo
-- CREATE ... IF NOT EXISTS: re-ejecutable, lo aplica también el paso "Apply global
-- schema additions on DRACO_DB" del deploy.
-- status: 'nueva' | 'en proceso' | 'descartada'.
CREATE TABLE IF NOT EXISTS drako_funding_opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  organism TEXT NOT NULL,
  description TEXT,
  amount_min INTEGER,
  amount_max INTEGER,
  deadline TEXT,
  url TEXT,
  tags TEXT,
  source TEXT,
  status TEXT DEFAULT 'nueva',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_funding_created ON drako_funding_opportunities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funding_title_organism ON drako_funding_opportunities(title, organism);
