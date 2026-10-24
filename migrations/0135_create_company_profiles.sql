-- Migration: 0135_create_company_profiles
-- Description: Flexible company profile for onboarding wizard.
-- Created: 2026-02-25

CREATE TABLE IF NOT EXISTS company_profiles (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  sector TEXT,
  address TEXT,
  zone TEXT,
  structured_context TEXT DEFAULT '{}',
  current_step INTEGER DEFAULT 1,
  completed_at TEXT,
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
