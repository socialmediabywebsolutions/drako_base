-- Mentoria User Acquisition Tracking
-- Tracks published posts and their performance metrics

CREATE TABLE IF NOT EXISTS acquisition_posts (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  content TEXT NOT NULL,
  published_at TEXT NOT NULL,
  external_id TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  signups INTEGER NOT NULL DEFAULT 0,
  trial_starts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Index for channel queries
CREATE INDEX IF NOT EXISTS idx_acquisition_posts_channel
  ON acquisition_posts(channel, published_at DESC);

-- Index for performance tracking
CREATE INDEX IF NOT EXISTS idx_acquisition_posts_metrics
  ON acquisition_posts(clicks, signups, trial_starts);
