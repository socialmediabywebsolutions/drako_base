-- Migration: 0128_canon_final_alignment.sql
-- Description: Align schema with Definitive Canon Prompt (Strict Constraints & Columns)

-- 1. Add stripe_event_id to billing_audit_logs if missing
-- SQLite does not support IF NOT EXISTS for ADD COLUMN, so we must be careful or accept error if exists.
-- However, D1 migrations are sequential.
DROP VIEW IF EXISTS v_latest_health_scores;
DROP VIEW IF EXISTS v_saas_performance;
ALTER TABLE billing_audit_logs ADD COLUMN stripe_event_id TEXT;

-- 2. Update saas_usage_quotas constraint to UNIQUE(tenant_id, saas_slug, quota_key, period_start)
-- We must recreate the table to change the constraint.
CREATE TABLE saas_usage_quotas_new (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    saas_slug TEXT NOT NULL,
    quota_key TEXT NOT NULL,
    limit_value INTEGER NOT NULL DEFAULT -1,
    current_value INTEGER DEFAULT 0,
    period_start TEXT,
    period_end TEXT,
    reset_at TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(tenant_id, saas_slug, quota_key, period_start)
);

INSERT INTO saas_usage_quotas_new (id, tenant_id, saas_slug, quota_key, limit_value, current_value, period_start, period_end, reset_at, created_at)
SELECT id, tenant_id, saas_slug, quota_key, limit_value, current_value, period_start, period_end, reset_at, created_at FROM saas_usage_quotas;

DROP TABLE saas_usage_quotas;
ALTER TABLE saas_usage_quotas_new RENAME TO saas_usage_quotas;

-- 3. Ensure billing_audit_logs index for idempotency
CREATE INDEX IF NOT EXISTS idx_billing_audit_stripe_event ON billing_audit_logs(stripe_event_id);
