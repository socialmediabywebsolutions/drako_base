CREATE TABLE IF NOT EXISTS saas_subscriptions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    saas_slug TEXT NOT NULL,
    plan_code TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_start TEXT,
    current_period_end TEXT,
    cancel_at_period_end INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT,
    UNIQUE(tenant_id, saas_slug)
);
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
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status ON stripe_webhook_events (status, received_at);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_tenant ON stripe_webhook_events (tenant_id, received_at);
CREATE TABLE IF NOT EXISTS mentoria_sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'mentoria-core',
    mentor_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('scheduled', 'active', 'completed', 'billed')),
    duration_minutes INTEGER DEFAULT 0,
    ai_tokens_used INTEGER DEFAULT 0,
    cost_est_major INTEGER DEFAULT 0,
    price_charged_major INTEGER DEFAULT 0,
    metadata_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    billed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_mentoria_sessions_tenant ON mentoria_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_sessions_mentor ON mentoria_sessions(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_sessions_client ON mentoria_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_sessions_status ON mentoria_sessions(status);
