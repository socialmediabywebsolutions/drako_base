CREATE TABLE IF NOT EXISTS revista_articles (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  body TEXT NOT NULL,
  saas_id TEXT, -- null = about the holding, else about a specific SaaS
  category TEXT NOT NULL DEFAULT 'general', -- 'producto', 'campana', 'logro', 'ia', 'general'
  cover_image_url TEXT,
  author_name TEXT NOT NULL DEFAULT 'Drako IA',
  published_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'published', -- 'draft' | 'published'
  source_post_ids TEXT -- JSON array of saas_social_posts ids that inspired this article
);
CREATE INDEX IF NOT EXISTS idx_revista_published ON revista_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_revista_saas ON revista_articles(saas_id, published_at DESC);
