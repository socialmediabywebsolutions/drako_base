-- Journal IA de drako.systems (DRACO_DB). Solo CREATE ... IF NOT EXISTS: re-ejecutable,
-- lo aplica el paso "Apply global schema additions on DRACO_DB" del deploy.
CREATE TABLE IF NOT EXISTS drako_journal_articles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  category TEXT NOT NULL DEFAULT 'ia',
  tags TEXT NOT NULL DEFAULT '[]',
  reading_time INTEGER NOT NULL DEFAULT 5,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_published INTEGER NOT NULL DEFAULT 1,
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_journal_published ON drako_journal_articles(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_slug ON drako_journal_articles(slug);
CREATE INDEX IF NOT EXISTS idx_journal_category ON drako_journal_articles(category);
