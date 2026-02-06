-- Migration: Create client_onboarding table
-- Description: Stores client business information collected during onboarding
-- Created: 2026-02-04

CREATE TABLE IF NOT EXISTS client_onboarding (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_email TEXT NOT NULL UNIQUE,
  
  -- Step 1: Basic Information
  contact_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  phone TEXT,
  
  -- Step 2: Location & Market
  address TEXT,
  latitude REAL,
  longitude REAL,
  sector TEXT,
  niche TEXT,
  
  -- Step 3: Digital Presence
  website_url TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  linkedin_url TEXT,
  tiktok_url TEXT,
  twitter_url TEXT,
  
  -- Step 4: Vision
  problem_statement TEXT,
  target_customer TEXT,
  goals TEXT, -- JSON array: ["increase_sales", "automate_processes", etc.]
  
  -- Metadata
  completed_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_onboarding_email ON client_onboarding(user_email);

-- Trigger to update updated_at
CREATE TRIGGER IF NOT EXISTS update_onboarding_timestamp AFTER UPDATE ON client_onboarding BEGIN UPDATE client_onboarding SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;
