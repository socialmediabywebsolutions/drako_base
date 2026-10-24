-- Add optional SaaS reference to alerts
ALTER TABLE alerts ADD COLUMN saas_id TEXT;
CREATE INDEX IF NOT EXISTS idx_alerts_saas_created ON alerts(saas_id, created_at DESC);
