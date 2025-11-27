import { run } from "@/lib/db";

const departments = [
  {
    id: "core_dir",
    slug: "direccion",
    nombre: "Dirección y Estrategia",
    descripcion: "Coordina visión, impacto y focos trimestrales de cada SaaS.",
    esCritico: 1,
  },
  {
    id: "core_mkt",
    slug: "marketing",
    nombre: "Marketing y Redes Sociales",
    descripcion: "Activa campañas, contenidos y posicionamiento orgánico/pago.",
    esCritico: 0,
  },
  {
    id: "core_sales",
    slug: "ventas",
    nombre: "Ventas y Comercial",
    descripcion: "Gestiona demos, renovaciones y forecast comercial.",
    esCritico: 1,
  },
  {
    id: "core_support",
    slug: "soporte",
    nombre: "Atención al cliente y Soporte",
    descripcion: "Resuelve incidencias, SLA y soporte de primer nivel.",
    esCritico: 1,
  },
  {
    id: "core_acc",
    slug: "contabilidad",
    nombre: "Contabilidad",
    descripcion: "Controla facturación, cobros y cashflow diario.",
    esCritico: 1,
  },
  {
    id: "core_tax",
    slug: "contabilidad_fiscal",
    nombre: "Contabilidad fiscal e impuestos",
    descripcion: "Gestiona IVA, modelos oficiales y obligaciones tributarias.",
    esCritico: 1,
  },
  {
    id: "core_legal",
    slug: "legal",
    nombre: "Legal y cumplimiento",
    descripcion: "Contratos, reclamaciones y normativa sectorial.",
    esCritico: 1,
  },
  {
    id: "core_dev",
    slug: "desarrollo",
    nombre: "Programación y Desarrollo",
    descripcion: "Mantiene el código, despliegues y calidad técnica.",
    esCritico: 1,
  },
  {
    id: "core_sec",
    slug: "ciberseguridad",
    nombre: "Ciberseguridad y seguridad",
    descripcion: "Audita accesos, credenciales y alertas de riesgo.",
    esCritico: 1,
  },
  {
    id: "core_grants",
    slug: "subvenciones",
    nombre: "Subvenciones y ayudas",
    descripcion: "Detecta programas públicos y coordina expedientes.",
    esCritico: 0,
  },
];

const agents = [
  {
    id: "core_agent_dir",
    department: "core_dir",
    slug: "agente-direccion",
    nombre: "Agente estratega del negocio",
    descripcion: "Resume métricas base y propone foco trimestral.",
    tipo: "estrategico",
  },
  {
    id: "core_agent_mkt",
    department: "core_mkt",
    slug: "agente-marketing",
    nombre: "Agente de marketing omnicanal",
    descripcion: "Activa campañas y posicionamiento social.",
    tipo: "creativo",
  },
  {
    id: "core_agent_sales",
    department: "core_sales",
    slug: "agente-ventas",
    nombre: "Agente comercial",
    descripcion: "Orquesta demos, presupuestos y seguimiento.",
    tipo: "operativo",
  },
  {
    id: "core_agent_support",
    department: "core_support",
    slug: "agente-soporte",
    nombre: "Agente de soporte",
    descripcion: "Gestiona tickets críticos y runbooks.",
    tipo: "operativo",
  },
  {
    id: "core_agent_acc",
    department: "core_acc",
    slug: "agente-contable",
    nombre: "Agente contable",
    descripcion: "Concilia facturas, cobros y gastos.",
    tipo: "financiero",
  },
  {
    id: "core_agent_tax",
    department: "core_tax",
    slug: "agente-fiscal",
    nombre: "Agente fiscal",
    descripcion: "Controla IVA, retenciones y modelos.",
    tipo: "financiero",
  },
  {
    id: "core_agent_legal",
    department: "core_legal",
    slug: "agente-legal",
    nombre: "Agente legal",
    descripcion: "Revisa contratos y riesgos regulatorios.",
    tipo: "legal",
  },
  {
    id: "core_agent_dev",
    department: "core_dev",
    slug: "agente-dev",
    nombre: "Agente de desarrollo",
    descripcion: "Coordina despliegues y calidad de código.",
    tipo: "tecnico",
  },
  {
    id: "core_agent_sec",
    department: "core_sec",
    slug: "agente-seguridad",
    nombre: "Agente de ciberseguridad",
    descripcion: "Monitorea eventos y controles de acceso.",
    tipo: "seguridad",
  },
  {
    id: "core_agent_grants",
    department: "core_grants",
    slug: "agente-ayudas",
    nombre: "Agente de subvenciones",
    descripcion: "Detecta y prepara convocatorias vigentes.",
    tipo: "financiero",
  },
];

const globalState = globalThis as { __campamentoBaseSeeded?: boolean };

export async function ensureCampamentoBase() {
  if (globalState.__campamentoBaseSeeded) {
    return;
  }

  for (const dept of departments) {
    await run(
      `INSERT INTO core_departments (id, slug, nombre, descripcion, es_critico)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         nombre = excluded.nombre,
         descripcion = excluded.descripcion,
         es_critico = excluded.es_critico`,
      dept.id,
      dept.slug,
      dept.nombre,
      dept.descripcion,
      dept.esCritico
    );
  }

  for (const agent of agents) {
    await run(
      `INSERT INTO core_agents (id, department_id, slug, nombre, descripcion, tipo)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         department_id = excluded.department_id,
         slug = excluded.slug,
         nombre = excluded.nombre,
         descripcion = excluded.descripcion,
         tipo = excluded.tipo`,
      agent.id,
      agent.department,
      agent.slug,
      agent.nombre,
      agent.descripcion,
      agent.tipo
    );
  }

  globalState.__campamentoBaseSeeded = true;
}
