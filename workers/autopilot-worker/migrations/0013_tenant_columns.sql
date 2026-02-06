-- Add tenant_id to legacy tables to enable multi-tenant isolation

ALTER TABLE owners ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE owners SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_owners_tenant ON owners(tenant_id, id);

ALTER TABLE clients ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE clients SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id, id);

ALTER TABLE client_saas ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE client_saas SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_saas_tenant ON client_saas(tenant_id, client_id);

ALTER TABLE saas ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE saas SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_saas_tenant ON saas(tenant_id, slug);

ALTER TABLE saas_agents ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE saas_agents SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_saas_agents_tenant ON saas_agents(tenant_id, saas_id);

ALTER TABLE provisioning ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE provisioning SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_provisioning_tenant ON provisioning(tenant_id, saas_id);

ALTER TABLE alerts ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE alerts SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON alerts(tenant_id, created_at);

ALTER TABLE metrics ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE metrics SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_metrics_tenant ON metrics(tenant_id, scope);

ALTER TABLE departments ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE departments SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_departments_tenant ON departments(tenant_id, id);

ALTER TABLE agents ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE agents SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id, department_id);

ALTER TABLE inbox_messages ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE inbox_messages SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_inbox_messages_tenant ON inbox_messages(tenant_id, created_at DESC);

ALTER TABLE grants ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE grants SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_grants_tenant ON grants(tenant_id, status);

ALTER TABLE invoices ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE invoices SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id, client_id);

ALTER TABLE tickets ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE tickets SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id, saas_id);

ALTER TABLE social_accounts ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE social_accounts SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_social_accounts_tenant ON social_accounts(tenant_id, saas_id);

ALTER TABLE orchestrator_messages ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';
UPDATE orchestrator_messages SET tenant_id = 'demo-tenant' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_orchestrator_messages_tenant ON orchestrator_messages(tenant_id, thread_id);
