-- 0050_drako_stripe_webhook_events.sql
-- Stripe webhook dedupe + processing ledger.

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  tenant_id TEXT,
  saas_slug TEXT,
  correlation_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
  ON stripe_webhook_events (status, received_at);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_tenant
  ON stripe_webhook_events (tenant_id, received_at);
