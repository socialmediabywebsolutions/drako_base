ALTER TABLE ai_usage_counters ADD COLUMN saas_id TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_usage_counters ADD COLUMN model TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_ai_usage_counters_saas_id ON ai_usage_counters(saas_id);
