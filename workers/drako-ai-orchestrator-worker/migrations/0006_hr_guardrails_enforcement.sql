-- 0030_hr_guardrails_enforcement.sql
-- Add enforcement settings to employee_hr_settings.

ALTER TABLE employee_hr_settings
  ADD COLUMN block_overwork INTEGER NOT NULL DEFAULT 1;

ALTER TABLE employee_hr_settings
  ADD COLUMN block_underpay INTEGER NOT NULL DEFAULT 0;

ALTER TABLE employee_hr_settings
  ADD COLUMN min_rest_hours_between_shifts REAL NOT NULL DEFAULT 0;
