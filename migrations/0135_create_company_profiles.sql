-- Migration: Create company_profiles table
-- Description: Flexible company profile for onboarding wizard.
--              Uses structured_context (JSON) for evolving fields
--              to avoid constant schema migrations.
-- Created: 2026-02-24

CREATE TABLE IF NOT EXISTS company_profiles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_email TEXT NOT NULL UNIQUE,

  -- Core fields (always needed, indexed)
  company_name TEXT NOT NULL,
  sector TEXT,
  address TEXT,
  zone TEXT,

  -- Flexible JSON blob for all wizard data
  -- Contains: business_status, has_physical_location, schedule,
  --   customer_type, offering, niche, sales_channels,
  --   website_url, social_networks, desired_social_networks, want_web_created,
  --   primary_goal, secondary_goals, departments, etc.
  structured_context TEXT DEFAULT '{}',

  -- Wizard progress tracking
  current_step INTEGER DEFAULT 1,
  completed_at TEXT,

  -- Metadata
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_company_profiles_email ON company_profiles(user_email);

CREATE TRIGGER IF NOT EXISTS trg_company_profiles_updated
  AFTER UPDATE ON company_profiles
  BEGIN
    UPDATE company_profiles
    SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = NEW.id;
  END;
