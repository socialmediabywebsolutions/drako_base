-- Seed demo tenant with baseline departments and agents

INSERT INTO tenants (id, slug, name, plan, status)
VALUES ('demo-tenant', 'demo', 'DRĀKO Demo Tenant', 'starter', 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, plan = excluded.plan, status = excluded.status,
  updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'));

INSERT INTO tenant_users (id, tenant_id, email, role)
VALUES ('demo-tenant-owner', 'demo-tenant', 'owner@demo.drako', 'owner')
ON CONFLICT(id) DO UPDATE SET email = excluded.email, role = excluded.role,
  updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'));

INSERT INTO tenant_departments (id, tenant_id, core_department_id, name, slug, is_active)
VALUES
  ('demo-dept-accounting', 'demo-tenant', 'core_acc', 'Accounting', 'accounting', 1),
  ('demo-dept-marketing', 'demo-tenant', 'core_mkt', 'Marketing', 'marketing', 1),
  ('demo-dept-legal', 'demo-tenant', 'core_legal', 'Legal', 'legal', 1),
  ('demo-dept-support', 'demo-tenant', 'core_support', 'Support', 'support', 1)
ON CONFLICT(id) DO UPDATE SET name = excluded.name, slug = excluded.slug, is_active = excluded.is_active,
  updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'));

INSERT INTO tenant_agents (id, tenant_id, core_agent_id, department_id, name, slug, status)
VALUES
  ('demo-agent-accounting', 'demo-tenant', 'core_agent_acc', 'demo-dept-accounting', 'Accounting Automation Agent', 'accounting-agent', 'active'),
  ('demo-agent-marketing', 'demo-tenant', 'core_agent_mkt', 'demo-dept-marketing', 'Marketing Pulse Agent', 'marketing-agent', 'active'),
  ('demo-agent-legal', 'demo-tenant', 'core_agent_legal', 'demo-dept-legal', 'Compliance Agent', 'legal-agent', 'active'),
  ('demo-agent-support', 'demo-tenant', 'core_agent_support', 'demo-dept-support', 'Support Desk Agent', 'support-agent', 'active')
ON CONFLICT(id) DO UPDATE SET status = excluded.status, department_id = excluded.department_id,
  updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
