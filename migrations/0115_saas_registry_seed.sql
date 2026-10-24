-- Phase 10: Registry Seed
-- Seed "Drako" and "MentorIA" instances.
-- Using 'demo-tenant' as the default owner for these core instances.
-- Using human-readable IDs for clarity, consistent with prior seeds.

INSERT INTO saas_instances (id, tenant_id, name, slug, status, plan_tier, created_at)
VALUES 
    ('saas-drako-core', 'demo-tenant', 'Drako', 'drako', 'active', 'enterprise', datetime('now')),
    ('saas-mentoria-core', 'demo-tenant', 'MentorIA', 'mentoria', 'active', 'pro', datetime('now'))
ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name,
    status = excluded.status,
    plan_tier = excluded.plan_tier;
