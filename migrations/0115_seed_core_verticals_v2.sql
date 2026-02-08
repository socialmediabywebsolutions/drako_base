-- Seed Core Verticals: Drako & MentorIA (Corrected)
-- Idempotent insert for saas_projects (NOT instances)

INSERT INTO saas_projects (id, tenant_id, slug, display_name, status, created_at, updated_at)
SELECT 'saas_drako_core', 'owner_root', 'drako', 'Drako Systems', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM saas_projects WHERE slug = 'drako');

INSERT INTO saas_projects (id, tenant_id, slug, display_name, status, created_at, updated_at)
SELECT 'saas_mentoria_core', 'owner_root', 'mentoria', 'MentorIA', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM saas_projects WHERE slug = 'mentoria');

-- Ensure domains exist for resolution
INSERT INTO saas_domains (id, tenant_id, saas_id, domain, status, is_primary, created_at, updated_at)
SELECT 'dom_drako_sys', 'owner_root', 'saas_drako_core', 'drako.systems', 'active', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM saas_domains WHERE domain = 'drako.systems');

INSERT INTO saas_domains (id, tenant_id, saas_id, domain, status, is_primary, created_at, updated_at)
SELECT 'dom_mentoria_sys', 'owner_root', 'saas_mentoria_core', 'mentoria.scholars', 'active', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM saas_domains WHERE domain = 'mentoria.scholars');
