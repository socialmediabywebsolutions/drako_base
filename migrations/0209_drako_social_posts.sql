-- Posts generados por el AutoPublishAgent para @drako.systems (DRACO_DB). Solo
-- CREATE ... IF NOT EXISTS: re-ejecutable, lo aplica también el paso "Apply global
-- schema additions on DRACO_DB" del deploy.
-- source_article_id es TEXT: los ids de drako_journal_articles son hex (randomblob).
-- status: 'pendiente' | 'publicado' | 'descartado'.
CREATE TABLE IF NOT EXISTS drako_social_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  hashtags TEXT,
  source_article_id TEXT,
  status TEXT DEFAULT 'pendiente',
  scheduled_at TEXT,
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_social_posts_created ON drako_social_posts(created_at DESC);
