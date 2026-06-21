-- Add saas_id and model dimensions to ai_usage_counters for per-SaaS AI cost tracking.
-- Existing rows (key format: "{tenantId}:{YYYY-M}") keep saas_id='' and model='' as defaults.
-- New rows (key format: "{tenantId}:{saasId}:{model}:{YYYY-M}") use the new columns.
ALTER TABLE ai_usage_counters ADD COLUMN saas_id TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_usage_counters ADD COLUMN model TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_ai_usage_counters_saas_id ON ai_usage_counters(saas_id);
