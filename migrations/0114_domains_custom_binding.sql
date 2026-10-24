-- Migration: 0114_domains_custom_binding
-- Description: Extend saas_instances for custom domain management and add audit log.

-- 1. Extender saas_instances
ALTER TABLE saas_instances ADD COLUMN trial_domain TEXT NOT NULL DEFAULT '';
ALTER TABLE saas_instances ADD COLUMN custom_domain TEXT;
ALTER TABLE saas_instances ADD COLUMN domain_status TEXT NOT NULL DEFAULT 'none'; -- none | locked | pending | verifying | verified | active | failed | pending_manual
ALTER TABLE saas_instances ADD COLUMN domain_verify_token TEXT;
ALTER TABLE saas_instances ADD COLUMN domain_last_checked_at TEXT;
ALTER TABLE saas_instances ADD COLUMN domain_error TEXT;
ALTER TABLE saas_instances ADD COLUMN domain_provider TEXT NOT NULL DEFAULT 'cloudflare';

CREATE UNIQUE INDEX idx_saas_instances_custom_domain ON saas_instances(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_saas_instances_domain_status ON saas_instances(domain_status);

-- 2. Tabla de auditoría (Audit Log)
CREATE TABLE domain_events (
    id TEXT PRIMARY KEY,
    saas_instance_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    type TEXT NOT NULL, -- DOMAIN_REQUESTED, DOMAIN_VERIFIED, DOMAIN_ACTIVATED, DOMAIN_FAILED, DOMAIN_REMOVED, DOMAIN_MANUAL_REQUIRED
    metadata TEXT, -- JSON
    created_at TEXT NOT NULL,
    FOREIGN KEY(saas_instance_id) REFERENCES saas_instances(id)
);

CREATE INDEX idx_domain_events_saas_id ON domain_events(saas_instance_id);
