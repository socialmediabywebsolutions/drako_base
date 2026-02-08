-- Seed Core Verticals: Drako & MentorIA
-- Idempotent insert for saas_instances

INSERT INTO saas_instances (id, slug, name, status, created_at, plan_tier, plan_status, owner_id)
SELECT 'saas_drako_core', 'drako', 'Drako Systems', 'active', unixepoch(), 'enterprise', 'active', 'owner_root'
WHERE NOT EXISTS (SELECT 1 FROM saas_instances WHERE slug = 'drako');

INSERT INTO saas_instances (id, slug, name, status, created_at, plan_tier, plan_status, owner_id)
SELECT 'saas_mentoria_core', 'mentoria', 'MentorIA', 'active', unixepoch(), 'business', 'active', 'owner_root'
WHERE NOT EXISTS (SELECT 1 FROM saas_instances WHERE slug = 'mentoria');

-- Ensure domains exist for resolution
INSERT INTO saas_domains (id, saas_id, domain, status, is_primary, created_at)
SELECT 'dom_drako_sys', 'saas_drako_core', 'drako.systems', 'active', 1, unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM saas_domains WHERE domain = 'drako.systems');

INSERT INTO saas_domains (id, saas_id, domain, status, is_primary, created_at)
SELECT 'dom_mentoria_sys', 'saas_mentoria_core', 'mentoria.scholars', 'active', 1, unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM saas_domains WHERE domain = 'mentoria.scholars');
