-- 0060_factory_ready_core.sql
-- Data model for Factory Ready P0: onboarding, research, knowledge, reports, checkout, assignments, catalogs.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS department_catalog (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  triggers TEXT NOT NULL,
  outputs TEXT NOT NULL,
  pack_basic INTEGER NOT NULL DEFAULT 1,
  pack_standard INTEGER NOT NULL DEFAULT 1,
  pack_full INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS agent_catalog (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  niches TEXT NOT NULL,
  specialty TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (department_id) REFERENCES department_catalog(id)
);

CREATE TABLE IF NOT EXISTS pack_catalog (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  departments TEXT NOT NULL,
  price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL,
  step TEXT NOT NULL,
  data_json TEXT NOT NULL,
  recommended_pack TEXT,
  radio_km REAL NOT NULL DEFAULT 2.0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS onboarding_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (session_id) REFERENCES onboarding_sessions(id)
);

CREATE TABLE IF NOT EXISTS research_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  result TEXT,
  requires_keys_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (session_id) REFERENCES onboarding_sessions(id)
);

CREATE TABLE IF NOT EXISTS knowledge_bases (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  summary TEXT NOT NULL,
  data_json TEXT NOT NULL,
  sources TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (session_id) REFERENCES onboarding_sessions(id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  content TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (session_id) REFERENCES onboarding_sessions(id)
);

CREATE TABLE IF NOT EXISTS report_files (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE TABLE IF NOT EXISTS checkouts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  data_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (session_id) REFERENCES onboarding_sessions(id)
);

CREATE TABLE IF NOT EXISTS agent_assignments (
  id TEXT PRIMARY KEY,
  saas_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  agent_catalog_id TEXT NOT NULL,
  pack_tier TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (department_id) REFERENCES department_catalog(id),
  FOREIGN KEY (agent_catalog_id) REFERENCES agent_catalog(id)
);

-- Seed department catalog
INSERT OR IGNORE INTO department_catalog (id, slug, name, capabilities, triggers, outputs, pack_basic, pack_standard, pack_full) VALUES
  ('dept_mkt_growth', 'marketing-growth', 'Marketing & Growth', '["Campañas pagadas","Funnels","Email marketing"]', '["Baja captación","Lanzamiento","Recuperar carritos"]', '["Plan de campaña","Calendario","Audiencias"]', 1, 1, 1),
  ('dept_social', 'social-media', 'Social Media & Content', '["Social orgánico","Contenido corto","Brand voice"]', '["Sin publicaciones","Caída de engagement"]', '["Calendario contenido","Guiones","Piezas base"]', 1, 1, 1),
  ('dept_sales', 'sales-crm', 'Sales / CRM', '["Embudo ventas","CRM","Playbooks"]', '["Leads sin seguimiento","Baja conversión"]', '["Pipeline","Scripts","Playbook follow-up"]', 0, 1, 1),
  ('dept_cx', 'customer-support', 'Customer Support', '["Helpdesk","SLA","Macros"]', '["Tickets acumulados","Mal NPS"]', '["Macros soporte","Flows CSAT","FAQ"]', 0, 1, 1),
  ('dept_ts', 'technical-support', 'Technical Support', '["Incidencias técnicas","Runbooks","Post-mortems"]', '["Incidentes","Bugs críticos"]', '["Runbook","Checklist hardening"]', 0, 1, 1),
  ('dept_fin', 'accounting-finance', 'Accounting / Finance', '["Facturación","Cashflow","Cobros"]', '["Descuadres","Mora"]', '["Calendario fiscal","Panel cashflow"]', 1, 1, 1),
  ('dept_legal', 'legal-compliance', 'Legal / Compliance', '["GDPR","Contratos","Políticas"]', '["Nuevos contratos","Procesar datos UE"]', '["Políticas","Cláusulas","Checklist GDPR"]', 0, 1, 1),
  ('dept_hr', 'hr-people', 'HR / People Ops', '["Onboarding","Roles","Evaluaciones"]', '["Alta/baja de equipo","Conflictos"]', '["Plan onboarding","Roles","Agenda 1:1"]', 0, 1, 1),
  ('dept_ops', 'operations-admin', 'Operations / Admin', '["Procesos","Checklists","Automations"]', '["Crecimiento desordenado","Mucho manual"]', '["Mapa procesos","SOPs","Automations"]', 1, 1, 1),
  ('dept_grants', 'grants-subsidies', 'Grants / Subsidies', '["Búsqueda ayudas","Elegibilidad","Expedientes"]', '["Nueva convocatoria","Expansión"]', '["Listado ayudas","Requisitos","Plan de acción"]', 0, 1, 1),
  ('dept_import', 'import-export', 'Import / Export', '["Aduanas","Incoterms","Logística"]', '["Nuevos países","Costes altos"]', '["Checklist aduanas","Plan ruta","Riesgos"]', 0, 0, 1),
  ('dept_analytics', 'analytics-bi', 'Analytics / BI', '["KPIs","Dashboards","Atribución"]', '["Falta visibilidad","CAC alto"]', '["Modelo KPIs","Dashboard","Insights"]', 0, 1, 1),
  ('dept_web', 'web-seo', 'Web / SEO', '["SEO local","On-page","Velocidad"]', '["Nueva web","Poca visibilidad"]', '["Plan SEO","Backlog web","Auditoría técnica"]', 1, 1, 1),
  ('dept_automation', 'automation-integrations', 'Automation / Integrations', '["Zapier/Make","Webhooks","Data sync"]', '["Trabajo manual","Errores de captura"]', '["Mapa flujos","Implementación","Monitoreo"]', 0, 1, 1);

-- Seed pack catalog
INSERT OR IGNORE INTO pack_catalog (id, tier, name, description, departments, price_cents) VALUES
  ('pack_basic', 'BASIC', 'Basic', 'Departamentos esenciales para arrancar', '["dept_mkt_growth","dept_social","dept_fin","dept_ops","dept_web"]', 14900),
  ('pack_standard', 'STANDARD', 'Standard', 'Incluye soporte, ventas y analytics', '["dept_mkt_growth","dept_social","dept_fin","dept_ops","dept_web","dept_sales","dept_cx","dept_analytics"]', 24900),
  ('pack_full', 'FULL', 'Full', 'Todo el stack + legal + automation + grants/import', '["dept_mkt_growth","dept_social","dept_fin","dept_ops","dept_web","dept_sales","dept_cx","dept_analytics","dept_legal","dept_hr","dept_automation","dept_grants","dept_import","dept_ts"]', 39900);

-- Seed agent catalog (generalista + nichos comunes)
INSERT OR IGNORE INTO agent_catalog (id, department_id, slug, name, niches, specialty) VALUES
  ('agent_mkt_general', 'dept_mkt_growth', 'mkt-general', 'Growth Partner Generalista', '["general"]', 'Estrategia de crecimiento'),
  ('agent_mkt_clinic', 'dept_mkt_growth', 'mkt-clinic', 'Growth para Clínicas', '["clinic","estetica","peluqueria"]', 'Captación local'),
  ('agent_mkt_pets', 'dept_mkt_growth', 'mkt-pets', 'Growth para Mascotas', '["mascotas"]', 'Campañas locales'),
  ('agent_social_general', 'dept_social', 'social-general', 'Social Media General', '["general"]', 'Calendario y guiones'),
  ('agent_social_clinic', 'dept_social', 'social-clinic', 'Social para Clínicas', '["clinic","estetica"]', 'UGC y autoridad'),
  ('agent_social_pets', 'dept_social', 'social-pets', 'Social para Mascotas', '["mascotas"]', 'Historias y comunidad'),
  ('agent_sales_general', 'dept_sales', 'sales-general', 'Sales/CRM General', '["general"]', 'Playbooks y pipeline'),
  ('agent_sales_clinic', 'dept_sales', 'sales-clinic', 'Sales para Clínicas', '["clinic","estetica"]', 'Reservas y recalls'),
  ('agent_sales_pets', 'dept_sales', 'sales-pets', 'Sales Mascotas', '["mascotas"]', 'Planes de fidelización'),
  ('agent_cx_general', 'dept_cx', 'cx-general', 'Customer Support General', '["general"]', 'Macros y SLAs'),
  ('agent_ts_general', 'dept_ts', 'ts-general', 'Technical Support', '["general"]', 'Runbooks'),
  ('agent_fin_general', 'dept_fin', 'fin-general', 'Finance Ops', '["general"]', 'Cashflow y facturación'),
  ('agent_fin_clinic', 'dept_fin', 'fin-clinic', 'Finance Clínicas', '["clinic","estetica"]', 'Ticket promedio y margen'),
  ('agent_legal_general', 'dept_legal', 'legal-general', 'Legal/Compliance', '["general"]', 'GDPR básico'),
  ('agent_hr_general', 'dept_hr', 'hr-general', 'HR/People', '["general"]', 'Onboarding y roles'),
  ('agent_ops_general', 'dept_ops', 'ops-general', 'Operations', '["general"]', 'SOPs y procesos'),
  ('agent_grants_general', 'dept_grants', 'grants-general', 'Grants/Subsidies', '["general"]', 'Búsqueda ayudas'),
  ('agent_import_general', 'dept_import', 'import-general', 'Import/Export', '["general"]', 'Aduanas/Incoterms'),
  ('agent_analytics_general', 'dept_analytics', 'analytics-general', 'Analytics/BI', '["general"]', 'KPIs y dashboards'),
  ('agent_web_general', 'dept_web', 'web-general', 'Web/SEO', '["general"]', 'SEO local'),
  ('agent_automation_general', 'dept_automation', 'automation-general', 'Automation', '["general"]', 'Integraciones'),
  ('agent_cx_clinic', 'dept_cx', 'cx-clinic', 'Customer Support Clínicas', '["clinic","estetica"]', 'FAQ y recalls'),
  ('agent_hr_clinic', 'dept_hr', 'hr-clinic', 'HR Clínicas', '["clinic","estetica"]', 'Turnos y guardias'),
  ('agent_ops_pets', 'dept_ops', 'ops-pets', 'Ops Mascotas', '["mascotas"]', 'SOP grooming'),
  ('agent_web_clinic', 'dept_web', 'web-clinic', 'Web/SEO Clínicas', '["clinic","estetica"]', 'SEO local salud'),
  ('agent_automation_pets', 'dept_automation', 'automation-pets', 'Automation Mascotas', '["mascotas"]', 'Recordatorios de vacunas');

