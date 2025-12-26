-- Campamento Base: departamentos y agentes core + readaptación de saas_agents
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS core_departments (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  es_critico INTEGER NOT NULL DEFAULT 0
);

INSERT INTO core_departments (id, slug, nombre, descripcion, es_critico)
VALUES
  ("core_dir", "direccion", "Dirección y Estrategia", "Coordina visión, impacto y focos trimestrales de cada SaaS.", 1),
  ("core_mkt", "marketing", "Marketing y Redes Sociales", "Activa campañas, contenidos y posicionamiento.", 0),
  ("core_sales", "atencion", "Ventas y Atención al Cliente", "Gestiona contacto con clientes finales y SLAs.", 1),
  ("core_support", "soporte", "Soporte Técnico", "Resuelve incidencias y bugs urgentes.", 1),
  ("core_dev", "programacion", "Programación / Desarrollo", "Mantiene el código y coordina despliegues.", 1),
  ("core_sec", "ciberseguridad", "Ciberseguridad", "Audita accesos, credenciales y alertas.", 1),
  ("core_legal", "legal", "Legal y Cumplimiento", "Contratos, compliance y protección de datos.", 1),
  ("core_grants", "subvenciones", "Ayudas y Subvenciones", "Detecta programas y subvenciones aplicables.", 0),
  ("core_acc", "contabilidad", "Contabilidad", "Controla facturas, cobros y cashflow.", 1),
  ("core_tax", "contabilidad_fiscal", "Contabilidad Fiscal", "Gestiona impuestos y modelos oficiales.", 1)
ON CONFLICT(id) DO UPDATE SET
  slug = excluded.slug,
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  es_critico = excluded.es_critico;

CREATE TABLE IF NOT EXISTS core_agents (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL,
  FOREIGN KEY (department_id) REFERENCES core_departments(id)
);

INSERT INTO core_agents (id, department_id, slug, nombre, descripcion, tipo)
VALUES
  ("core_agent_dir", "core_dir", "agente-direccion", "Agente estratega del negocio", "Resume métricas clave y propone foco trimestral.", "estrategico"),
  ("core_agent_mkt", "core_mkt", "agente-marketing", "Agente de campañas y redes sociales", "Activa y evalúa campañas pagadas y orgánicas.", "creativo"),
  ("core_agent_sales", "core_sales", "agente-atencion", "Agente de atención al cliente", "Orquesta respuestas y flujos de soporte comercial.", "operativo"),
  ("core_agent_support", "core_support", "agente-soporte", "Agente de soporte técnico", "Escala incidencias y ejecuta runbooks.", "operativo"),
  ("core_agent_dev", "core_dev", "agente-dev", "Agente de mantenimiento de código", "Coordina despliegues y control de calidad.", "tecnico"),
  ("core_agent_sec", "core_sec", "agente-ciber", "Agente de ciberseguridad", "Supervisa accesos, credenciales y alertas.", "seguridad"),
  ("core_agent_legal", "core_legal", "agente-legal", "Agente legal sectorial", "Revisa contratos y riesgos regulatorios.", "legal"),
  ("core_agent_grants", "core_grants", "agente-ayudas", "Agente de búsqueda de ayudas", "Detecta subvenciones y prepara expedientes.", "financiero"),
  ("core_agent_acc", "core_acc", "agente-contable", "Agente de facturación", "Conciliación de cobros/gastos y reporte cashflow.", "financiero"),
  ("core_agent_tax", "core_tax", "agente-fiscal", "Agente fiscal", "Controla modelos y obligaciones tributarias.", "financiero")
ON CONFLICT(id) DO UPDATE SET
  department_id = excluded.department_id,
  slug = excluded.slug,
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  tipo = excluded.tipo;

DROP TABLE IF EXISTS saas_agents;
CREATE TABLE saas_agents (
  id TEXT PRIMARY KEY,
  saas_id TEXT NOT NULL,
  core_agent_id TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activo',
  config TEXT NOT NULL DEFAULT '{}',
  assigned_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (saas_id) REFERENCES saas(id),
  FOREIGN KEY (core_agent_id) REFERENCES core_agents(id)
);

CREATE INDEX IF NOT EXISTS idx_saas_agents_saas ON saas_agents(saas_id);
CREATE INDEX IF NOT EXISTS idx_saas_agents_core ON saas_agents(core_agent_id);
