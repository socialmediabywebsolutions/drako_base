-- Seed demo SaaS project and domain mapping for demo tenant (idempotent)

-- Register demo SaaS project (control plane tracking)
INSERT OR IGNORE INTO saas_projects (id, tenant_id, slug, display_name, status, created_at, updated_at)
VALUES (
  'saas_project_demo',
  'demo-tenant',
  'demo-saas',
  'Demo SaaS Project',
  'active',
  strftime('%Y-%m-%dT%H:%M:%fZ','now'),
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
);

-- Ensure SaaS domain mapping exists (pending verification)
INSERT OR IGNORE INTO saas_domains (id, tenant_id, saas_id, domain, status, verification_status, verification_token, created_at)
VALUES (
  'saas_domain_demo',
  'demo-tenant',
  'saas_demo',
  'demo-saas.drako.local',
  'pending',
  'pending_dns',
  'token_demo_domain',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
);
