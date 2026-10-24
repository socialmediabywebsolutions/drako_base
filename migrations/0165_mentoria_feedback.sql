-- Mentoria User Feedback
-- Collects user feedback for product optimization

CREATE TABLE IF NOT EXISTS user_feedback (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  session_count INTEGER NOT NULL,
  liked_json TEXT NOT NULL DEFAULT '[]',
  missing_json TEXT NOT NULL DEFAULT '[]',
  overall_sentiment TEXT NOT NULL,
  would_recommend INTEGER NOT NULL DEFAULT 0,
  collected_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(tenant_id) REFERENCES tenants(id),
  FOREIGN KEY(student_profile_id) REFERENCES student_profiles(id)
);

-- Index for sentiment analysis
CREATE INDEX IF NOT EXISTS idx_user_feedback_sentiment
  ON user_feedback(overall_sentiment, collected_at DESC);

-- Index for recommendation tracking
CREATE INDEX IF NOT EXISTS idx_user_feedback_recommendation
  ON user_feedback(would_recommend, collected_at DESC);
