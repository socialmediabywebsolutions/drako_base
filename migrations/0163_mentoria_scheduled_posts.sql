-- Mentoria Scheduled Posts
-- Manages daily content scheduling and automation

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  content TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  published_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Index for pending posts
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_pending
  ON scheduled_posts(status, scheduled_for)
  WHERE status = 'pending';

-- Index for published posts
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_published
  ON scheduled_posts(channel, published_at DESC)
  WHERE status = 'published';
