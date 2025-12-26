import { queryAll, run } from "@/lib/db";

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

export function getCampamentoCoreDepartmentsCatalog() {
  return departments.map((dept) => ({
    id: dept.id,
    slug: dept.slug,
    nombre: dept.nombre,
    descripcion: dept.descripcion,
    es_critico: dept.esCritico,
  }));
}

export function getCampamentoCoreAgentsCatalog() {
  return agents.map((agent) => ({
    id: agent.id,
    department_id: agent.department,
    slug: agent.slug,
    nombre: agent.nombre,
    descripcion: agent.descripcion,
    tipo: agent.tipo,
  }));
}

const agents = [
  // Strategy & Direction
  {
    id: "core_agent_dir",
    department: "core_dir",
    slug: "strategy-analyst",
    nombre: "Analista de estrategia",
    descripcion: "Analiza KPIs globales y propone foco trimestral por SaaS.",
    tipo: "analyst",
  },
  {
    id: "core_agent_dir_planner",
    department: "core_dir",
    slug: "okr-planner",
    nombre: "Planificador OKR",
    descripcion: "Traduce objetivos de negocio en planes y OKR trimestrales.",
    tipo: "operator",
  },
  {
    id: "core_agent_dir_supervisor",
    department: "core_dir",
    slug: "strategy-supervisor",
    nombre: "Supervisor de foco",
    descripcion: "Vigila desvíos de foco y genera alertas estratégicas.",
    tipo: "supervisor",
  },

  // Marketing & Social
  {
    id: "core_agent_mkt",
    department: "core_mkt",
    slug: "campaign-designer",
    nombre: "Diseñador de campañas",
    descripcion: "Configura campañas omnicanal a partir de briefs y objetivos.",
    tipo: "operator",
  },
  {
    id: "core_agent_mkt_publisher",
    department: "core_mkt",
    slug: "social-publisher",
    nombre: "Publicador social",
    descripcion: "Programa y publica contenidos en redes según el calendario.",
    tipo: "automation",
  },
  {
    id: "core_agent_mkt_analyst",
    department: "core_mkt",
    slug: "performance-analyst",
    nombre: "Analista de performance",
    descripcion: "Revisa métricas de campañas y propone optimizaciones.",
    tipo: "analyst",
  },

  // Sales & Success
  {
    id: "core_agent_sales",
    department: "core_sales",
    slug: "lead-scoring",
    nombre: "Scoreador de leads",
    descripcion: "Prioriza leads según probabilidad de cierre y urgencia.",
    tipo: "analyst",
  },
  {
    id: "core_agent_sales_followup",
    department: "core_sales",
    slug: "followup-operator",
    nombre: "Operador de seguimiento",
    descripcion: "Orquesta recordatorios y follow-ups en la bandeja comercial.",
    tipo: "operator",
  },
  {
    id: "core_agent_sales_proposals",
    department: "core_sales",
    slug: "proposal-writer",
    nombre: "Redactor de propuestas",
    descripcion: "Genera propuestas y resúmenes ejecutivos listos para enviar.",
    tipo: "operator",
  },

  // Operations & Support
  {
    id: "core_agent_support",
    department: "core_support",
    slug: "support-router",
    nombre: "Enrutador de tickets",
    descripcion: "Clasifica mensajes de inbox y los asigna al departamento correcto.",
    tipo: "operator",
  },
  {
    id: "core_agent_support_runbook",
    department: "core_support",
    slug: "runbook-advisor",
    nombre: "Asesor de runbooks",
    descripcion: "Sugiere pasos de resolución y actualiza documentación operacional.",
    tipo: "analyst",
  },
  {
    id: "core_agent_support_supervisor",
    department: "core_support",
    slug: "sla-supervisor",
    nombre: "Supervisor de SLA",
    descripcion: "Supervisa tiempos de respuesta y dispara alertas de SLA.",
    tipo: "supervisor",
  },

  // Finance & Accounting
  {
    id: "core_agent_acc",
    department: "core_acc",
    slug: "cashflow-analyst",
    nombre: "Analista de cashflow",
    descripcion: "Concilia cobros y pagos y detecta tensiones de caja.",
    tipo: "analyst",
  },
  {
    id: "core_agent_acc_billing",
    department: "core_acc",
    slug: "billing-operator",
    nombre: "Operador de facturación",
    descripcion: "Genera facturas y coordina recordatorios de cobro.",
    tipo: "operator",
  },
  {
    id: "core_agent_tax",
    department: "core_tax",
    slug: "tax-compliance",
    nombre: "Agente fiscal",
    descripcion: "Controla IVA, retenciones y modelos periódicos.",
    tipo: "supervisor",
  },

  // Legal & Compliance
  {
    id: "core_agent_legal",
    department: "core_legal",
    slug: "contract-reviewer",
    nombre: "Revisor de contratos",
    descripcion: "Analiza contratos y resalta riesgos regulatorios.",
    tipo: "analyst",
  },
  {
    id: "core_agent_legal_privacy",
    department: "core_legal",
    slug: "privacy-operator",
    nombre: "Operador de privacidad",
    descripcion: "Prepara cláusulas y avisos legales para nuevos SaaS.",
    tipo: "operator",
  },

  // Grants & Funding
  {
    id: "core_agent_grants",
    department: "core_grants",
    slug: "grants-scout",
    nombre: "Explorador de ayudas",
    descripcion: "Detecta convocatorias públicas alineadas con cada cliente.",
    tipo: "analyst",
  },
  {
    id: "core_agent_grants_writer",
    department: "core_grants",
    slug: "grant-writer",
    nombre: "Redactor de expedientes",
    descripcion: "Esboza memorias y documentación base para solicitudes.",
    tipo: "operator",
  },

  // Tech & Development
  {
    id: "core_agent_dev",
    department: "core_dev",
    slug: "release-operator",
    nombre: "Operador de despliegues",
    descripcion: "Coordina releases y verifica checklists de despliegue.",
    tipo: "operator",
  },
  {
    id: "core_agent_dev_reviewer",
    department: "core_dev",
    slug: "code-reviewer",
    nombre: "Revisor de código",
    descripcion: "Resume PRs y resalta riesgos técnicos antes de fusionar.",
    tipo: "analyst",
  },

  // Security & Risk
  {
    id: "core_agent_sec",
    department: "core_sec",
    slug: "security-monitor",
    nombre: "Monitor de seguridad",
    descripcion: "Monitorea eventos, accesos y anomalías de credenciales.",
    tipo: "monitor",
  },
  {
    id: "core_agent_sec_incident",
    department: "core_sec",
    slug: "incident-supervisor",
    nombre: "Supervisor de incidentes",
    descripcion: "Coordina respuesta a incidentes y escalado a equipos técnicos.",
    tipo: "supervisor",
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

  await seedAdministrativeBackbone();

  globalState.__campamentoBaseSeeded = true;
}

async function seedAdministrativeBackbone() {
  const ownerId = "owner_drako_base";
  await run(
    `INSERT INTO owners (id, name, nif, email, phone, country, city, address)
     VALUES (?, 'DRĀKO Systems', 'B12345678', 'admin@drako.systems', '+34 600 000 000', 'Spain', 'Barcelona', 'Passeig de Gràcia 1')
     ON CONFLICT(id) DO NOTHING`,
    ownerId
  );

  const demoClients = [
    {
      id: "client_demo_clinic",
      name: "Clínica Demo",
      nif: "C12345678",
      email: "facturacion@clinicademo.com",
      phone: "+34 611 111 111",
      city: "Madrid",
    },
    {
      id: "client_demo_studio",
      name: "Studio Creativo",
      nif: "S87654321",
      email: "hello@studiocreativo.io",
      phone: "+34 622 222 222",
      city: "Valencia",
    },
  ];

  for (const client of demoClients) {
    await run(
      `INSERT INTO clients (id, owner_id, name, nif, email, phone, country, city, address)
       VALUES (?, ?, ?, ?, ?, ?, 'Spain', ?, 'Dirección demo')
       ON CONFLICT(id) DO NOTHING`,
      client.id,
      ownerId,
      client.name,
      client.nif,
      client.email,
      client.phone,
      client.city
    );
  }

  const saasList = await queryAll<{ id: string; slug: string }>("SELECT id, slug FROM saas ORDER BY created_at ASC");
  if (saasList.length === 0) {
    return;
  }
  const firstSaas = saasList[0];

  const existingLink = await queryAll<{ id: string }>("SELECT id FROM client_saas WHERE saas_id = ? LIMIT 1", firstSaas.id);
  if (existingLink.length === 0) {
    await run(
      `INSERT INTO client_saas (id, client_id, saas_id, status, plan)
       VALUES (?, ?, ?, 'active', 'standard')
       ON CONFLICT(id) DO NOTHING`,
      `link_${firstSaas.id}`,
      demoClients[0].id,
      firstSaas.id
    );
  }
}
