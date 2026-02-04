-- Migration 0101: Create competitive_analysis table
-- This table stores the comparative analysis between client and competitors

CREATE TABLE IF NOT EXISTS competitive_analysis (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  
  -- Client Metrics (from their social media and web)
  client_instagram_posts_week REAL,
  client_instagram_likes_avg REAL,
  client_instagram_engagement REAL,
  client_facebook_posts_week REAL,
  client_facebook_interactions_avg REAL,
  client_google_rating REAL,
  client_review_count INTEGER,
  client_pricing_avg REAL,
  client_services_count INTEGER,
  
  -- Competitor Averages (calculated from all competitors found)
  comp_instagram_posts_week_avg REAL,
  comp_instagram_likes_avg_avg REAL,
  comp_instagram_engagement_avg REAL,
  comp_facebook_posts_week_avg REAL,
  comp_facebook_interactions_avg_avg REAL,
  comp_google_rating_avg REAL,
  comp_review_count_avg INTEGER,
  comp_pricing_avg_avg REAL,
  comp_services_count_avg REAL,
  
  -- Gaps (%) - Negative means client is behind
  gap_instagram_posts REAL,
  gap_instagram_likes REAL,
  gap_engagement REAL,
  gap_facebook_posts REAL,
  gap_pricing REAL,
  
  -- Results
  competitors_found INTEGER,
  competitors_data TEXT,  -- JSON array of all competitors analyzed
  opportunities TEXT,  -- JSON array of identified opportunities
  recommended_departments TEXT,  -- JSON array of recommended Drako departments
  strengths TEXT,  -- JSON array
  weaknesses TEXT,  -- JSON array
  
  -- PDF
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP,
  
  -- Meta
  analysis_started_at TIMESTAMP,
  analysis_completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_email) REFERENCES client_onboarding(user_email)
);

CREATE INDEX IF NOT EXISTS idx_competitive_analysis_email ON competitive_analysis(user_email);
CREATE INDEX IF NOT EXISTS idx_competitive_analysis_status ON competitive_analysis(status);
