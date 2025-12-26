-- DRĀKO core departments and agents seeding
-- Adds richer metadata to departments and flags base agents

ALTER TABLE departments ADD COLUMN description TEXT;
ALTER TABLE agents ADD COLUMN is_core INTEGER NOT NULL DEFAULT 0;

-- Upsert core departments with descriptive copy
INSERT INTO departments (id, name, description)
VALUES
  ('admin', 'Administración general', 'Dirección operativa que coordina todos los módulos y garantiza el cumplimiento de objetivos.'),
  ('accounting', 'Contabilidad', 'Controla ingresos, gastos y reportes financieros diarios de cada SaaS.'),
  ('tax', 'Contabilidad fiscal', 'Gestiona obligaciones fiscales, modelos y declaraciones automatizadas.'),
  ('marketing', 'Marketing y crecimiento', 'Optimiza campañas, funnels y adquisición de clientes de cada proyecto.'),
  ('support', 'Atención al cliente y soporte', 'Responde tickets y mide la satisfacción de usuarios finales.'),
  ('service', 'Servicio técnico', 'Vigila infraestructura, dominios y certificados para minimizar caídas.'),
  ('dev', 'Programación y desarrollo', 'Gestiona despliegues, backlog técnico y calidad del código.'),
  ('cyber', 'Ciberseguridad', 'Audita accesos, credenciales y alertas de seguridad 24/7.'),
  ('legal', 'Legal y cumplimiento', 'Custodia contratos, compliance y protección de datos.'),
  ('grants', 'Subvenciones y ayudas', 'Detecta oportunidades públicas/privadas para financiar los SaaS.')
ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description;

-- Seed core agents (one por departamento) si no existen
INSERT OR IGNORE INTO agents (id, name, department_id, provider, model, active, is_core)
VALUES
  ('agent_admin_base', 'Agente de Administración', 'admin', 'DeepSeek', 'deepseek-r1', 1, 1),
  ('agent_accounting_base', 'Agente de Contabilidad', 'accounting', 'Fireworks', 'fireworks-mixtral-8x7b', 1, 1),
  ('agent_tax_base', 'Agente Fiscal', 'tax', 'DeepSeek', 'deepseek-r1', 1, 1),
  ('agent_marketing_base', 'Agente de Marketing', 'marketing', 'Gemini', 'gemini-1.5-pro', 1, 1),
  ('agent_support_base', 'Agente de Soporte', 'support', 'Fireworks', 'fireworks-mixtral-8x7b', 1, 1),
  ('agent_service_base', 'Agente de Servicio Técnico', 'service', 'DeepSeek', 'deepseek-r1', 1, 1),
  ('agent_dev_base', 'Agente de Desarrollo', 'dev', 'Gemini', 'gemini-1.5-pro', 1, 1),
  ('agent_cyber_base', 'Agente de Ciberseguridad', 'cyber', 'Fireworks', 'fireworks-mixtral-8x7b', 1, 1),
  ('agent_legal_base', 'Agente Legal', 'legal', 'DeepSeek', 'deepseek-r1', 1, 1),
  ('agent_grants_base', 'Agente de Subvenciones', 'grants', 'Gemini', 'gemini-1.5-flash', 1, 1);
