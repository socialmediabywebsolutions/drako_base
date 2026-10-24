-- Seed demo tenant with minimal data for local preview (idempotent)

INSERT OR IGNORE INTO tenants (id, slug, name, plan, status)
VALUES ('demo-tenant', 'demo', 'DRĀKO Demo Tenant', 'starter', 'active');

-- Departments (legacy table) with tenant scoping
INSERT OR IGNORE INTO departments (id, name, description, tenant_id) VALUES
  ('dept_dir', 'Dirección y Estrategia', 'Gobierno y foco del negocio', 'demo-tenant'),
  ('dept_mkt', 'Marketing y Redes', 'Campañas y contenido', 'demo-tenant'),
  ('dept_sales', 'Ventas y Customer Success', 'Ventas y soporte a clientes', 'demo-tenant'),
  ('dept_ops', 'Operaciones', 'Operaciones internas', 'demo-tenant'),
  ('dept_fin', 'Finanzas', 'Control financiero y facturación', 'demo-tenant');

-- Agents (legacy table) tied to the demo departments
INSERT OR IGNORE INTO agents (id, name, department_id, provider, model, active, tenant_id) VALUES
  ('agent_dir', 'Estratega del negocio', 'dept_dir', NULL, NULL, 1, 'demo-tenant'),
  ('agent_mkt', 'Agente de marketing omnicanal', 'dept_mkt', NULL, NULL, 1, 'demo-tenant'),
  ('agent_sales', 'Agente de ventas y soporte', 'dept_sales', NULL, NULL, 1, 'demo-tenant'),
  ('agent_fin', 'Agente financiero', 'dept_fin', NULL, NULL, 1, 'demo-tenant');

-- SaaS demo project
INSERT OR IGNORE INTO saas (id, name, slug, domain, subdomain, status, tenant_id)
VALUES ('saas_demo', 'Demo SaaS', 'demo-saas', NULL, 'demo-saas', 'active', 'demo-tenant');

-- Simple metric seed
INSERT OR IGNORE INTO metrics (id, tenant_id, scope, token_count, ai_cost_cents, roi, captured_at)
VALUES (10001, 'demo-tenant', 'saas:saas_demo', 12000, 450, 2.5, strftime('%Y-%m-%dT%H:%M:%fZ','now'));

