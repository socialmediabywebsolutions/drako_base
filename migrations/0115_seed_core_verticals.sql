-- Seed Core Verticals: Drako & MentorIA
-- Idempotent insert for saas_instances and domains

-- 1. Ensure Root Tenant Exists
INSERT INTO tenants (id, slug, name, plan, status)
SELECT 'tenant_root', 'root', 'Drako Core Tenant', 'enterprise', 'active'
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = 'tenant_root');

-- 2. Seed SaaS Instances (Base Schema: 0111)
INSERT INTO saas_instances (id, tenant_id, slug, name, status, created_at, updated_at, plan_tier)
SELECT 'saas_drako_core', 'tenant_root', 'drako', 'Drako Systems', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'enterprise'
WHERE NOT EXISTS (SELECT 1 FROM saas_instances WHERE slug = 'drako');

INSERT INTO saas_instances (id, tenant_id, slug, name, status, created_at, updated_at, plan_tier)
SELECT 'saas_mentoria_core', 'tenant_root', 'mentoria', 'MentorIA', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'business'
WHERE NOT EXISTS (SELECT 1 FROM saas_instances WHERE slug = 'mentoria');

-- 3. Seed SaaS Domains (Base Schema: 0028)
INSERT INTO saas_domains (id, tenant_id, saas_id, domain, status, is_primary, created_at, updated_at)
SELECT 'dom_drako_sys', 'tenant_root', 'saas_drako_core', 'drako.systems', 'active', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM saas_domains WHERE domain = 'drako.systems');

INSERT INTO saas_domains (id, tenant_id, saas_id, domain, status, is_primary, created_at, updated_at)
SELECT 'dom_mentoria_sys', 'tenant_root', 'saas_mentoria_core', 'mentoria.scholars', 'active', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM saas_domains WHERE domain = 'mentoria.scholars');
