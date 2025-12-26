export type AgentTemplate = {
  id: string;
  department: "MARKETING" | "ACCOUNTING" | "SUPPORT" | "TAX" | "OPS";
  roleName: string;
  description: string;
  defaultAiTier: "COST_SAVER" | "BALANCED" | "PREMIUM";
  verticals?: string[];
  packs?: string[];
  responsibilities: string[];
};

export type DepartmentId = "MARKETING" | "ACCOUNTING" | "SUPPORT" | "EMAIL_INTAKE" | "OPS" | "TAX";
export type AgentPackTier = "BASIC" | "STANDARD" | "FULL";

export type AgentTemplateDefinition = {
  key: string;
  departmentId: DepartmentId;
  roleName: string;
  description: string;
  aiProfile?: {
    tier: "LOW_COST" | "BALANCED" | "PREMIUM";
    preferredProviders?: string[];
  };
  coreAgentId?: string;
};

export type AgentPackDefinition = {
  departmentId: DepartmentId;
  tier: AgentPackTier;
  label: string;
  agents: AgentTemplateDefinition[];
};

export const BASE_AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "marketing.organic.manager",
    department: "MARKETING",
    roleName: "Marketing organico",
    description: "Diseña calendarios de contenido y posts organicos por vertical.",
    defaultAiTier: "BALANCED",
    packs: ["BASIC", "STANDARD", "FULL"],
    responsibilities: ["Calendario de posts", "Contenido social", "Mensajes de marca"],
  },
  {
    id: "marketing.paid.manager",
    department: "MARKETING",
    roleName: "Marketing de pago",
    description: "Configura campañas pagadas y coordina ajustes de rendimiento.",
    defaultAiTier: "PREMIUM",
    packs: ["STANDARD", "FULL"],
    responsibilities: ["Plan de ads", "Configuracion de campañas", "Optimizar ROI"],
  },
  {
    id: "accounting.controller",
    department: "ACCOUNTING",
    roleName: "Contabilidad y reporting",
    description: "Gestiona facturacion, proveedores y reportes contables.",
    defaultAiTier: "BALANCED",
    packs: ["BASIC", "FULL"],
    responsibilities: ["Facturas", "Proveedores", "Libros contables"],
  },
  {
    id: "tax.compliance",
    department: "TAX",
    roleName: "Fiscalidad e impuestos",
    description: "Prepara IVA/IRPF y supervisa cumplimiento fiscal.",
    defaultAiTier: "BALANCED",
    packs: ["BASIC", "FULL"],
    responsibilities: ["IVA", "IRPF", "Modelos trimestrales"],
  },
  {
    id: "support.customer.success",
    department: "SUPPORT",
    roleName: "Atencion al cliente",
    description: "Responde a clientes y coordina soporte de primer nivel.",
    defaultAiTier: "BALANCED",
    packs: ["BASIC", "STANDARD", "FULL"],
    responsibilities: ["WhatsApp", "Email", "Seguimiento"],
  },
  {
    id: "ops.agenda.manager",
    department: "OPS",
    roleName: "Operaciones y agenda",
    description: "Gestiona citas, capacidad y flujos operativos.",
    defaultAiTier: "COST_SAVER",
    packs: ["BASIC", "STANDARD", "FULL"],
    responsibilities: ["Agenda", "Capacidad", "Checklists"],
  },
];

export const AGENT_PACKS_BY_DEPARTMENT: AgentPackDefinition[] = [
  {
    departmentId: "MARKETING",
    tier: "BASIC",
    label: "Marketing BASIC",
    agents: [
      {
        key: "marketing_campaign_planners",
        departmentId: "MARKETING",
        roleName: "Campaign Planners",
        description: "Plan campaign calendars and creative briefs.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_mkt",
      },
      {
        key: "marketing_social_publishers",
        departmentId: "MARKETING",
        roleName: "Social Publishers",
        description: "Schedule and publish social content.",
        aiProfile: { tier: "LOW_COST" },
        coreAgentId: "core_agent_mkt_publisher",
      },
    ],
  },
  {
    departmentId: "MARKETING",
    tier: "STANDARD",
    label: "Marketing STANDARD",
    agents: [
      {
        key: "marketing_campaign_planners",
        departmentId: "MARKETING",
        roleName: "Campaign Planners",
        description: "Plan campaign calendars and creative briefs.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_mkt",
      },
      {
        key: "marketing_social_publishers",
        departmentId: "MARKETING",
        roleName: "Social Publishers",
        description: "Schedule and publish social content.",
        aiProfile: { tier: "LOW_COST" },
        coreAgentId: "core_agent_mkt_publisher",
      },
      {
        key: "marketing_performance_analysts",
        departmentId: "MARKETING",
        roleName: "Performance Analysts",
        description: "Track performance and optimize campaigns.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_mkt_analyst",
      },
    ],
  },
  {
    departmentId: "MARKETING",
    tier: "FULL",
    label: "Marketing FULL",
    agents: [
      {
        key: "marketing_campaign_planners",
        departmentId: "MARKETING",
        roleName: "Campaign Planners",
        description: "Plan campaign calendars and creative briefs.",
        aiProfile: { tier: "PREMIUM" },
        coreAgentId: "core_agent_mkt",
      },
      {
        key: "marketing_social_publishers",
        departmentId: "MARKETING",
        roleName: "Social Publishers",
        description: "Schedule and publish social content.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_mkt_publisher",
      },
      {
        key: "marketing_performance_analysts",
        departmentId: "MARKETING",
        roleName: "Performance Analysts",
        description: "Track performance and optimize campaigns.",
        aiProfile: { tier: "PREMIUM" },
        coreAgentId: "core_agent_mkt_analyst",
      },
    ],
  },
  {
    departmentId: "ACCOUNTING",
    tier: "BASIC",
    label: "Accounting BASIC",
    agents: [
      {
        key: "accounting_cashflow_analysts",
        departmentId: "ACCOUNTING",
        roleName: "Cashflow Analysts",
        description: "Monitor cashflow and billing operations.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_acc",
      },
    ],
  },
  {
    departmentId: "ACCOUNTING",
    tier: "STANDARD",
    label: "Accounting STANDARD",
    agents: [
      {
        key: "accounting_cashflow_analysts",
        departmentId: "ACCOUNTING",
        roleName: "Cashflow Analysts",
        description: "Monitor cashflow and billing operations.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_acc",
      },
      {
        key: "accounting_billing_operators",
        departmentId: "ACCOUNTING",
        roleName: "Billing Operators",
        description: "Generate invoices and manage reminders.",
        aiProfile: { tier: "LOW_COST" },
        coreAgentId: "core_agent_acc_billing",
      },
    ],
  },
  {
    departmentId: "ACCOUNTING",
    tier: "FULL",
    label: "Accounting FULL",
    agents: [
      {
        key: "accounting_cashflow_analysts",
        departmentId: "ACCOUNTING",
        roleName: "Cashflow Analysts",
        description: "Monitor cashflow and billing operations.",
        aiProfile: { tier: "PREMIUM" },
        coreAgentId: "core_agent_acc",
      },
      {
        key: "accounting_billing_operators",
        departmentId: "ACCOUNTING",
        roleName: "Billing Operators",
        description: "Generate invoices and manage reminders.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_acc_billing",
      },
    ],
  },
  {
    departmentId: "SUPPORT",
    tier: "BASIC",
    label: "Support BASIC",
    agents: [
      {
        key: "support_ticket_routers",
        departmentId: "SUPPORT",
        roleName: "Ticket Routers",
        description: "Route incoming tickets and requests.",
        aiProfile: { tier: "LOW_COST" },
        coreAgentId: "core_agent_support",
      },
    ],
  },
  {
    departmentId: "SUPPORT",
    tier: "STANDARD",
    label: "Support STANDARD",
    agents: [
      {
        key: "support_ticket_routers",
        departmentId: "SUPPORT",
        roleName: "Ticket Routers",
        description: "Route incoming tickets and requests.",
        aiProfile: { tier: "LOW_COST" },
        coreAgentId: "core_agent_support",
      },
      {
        key: "support_runbook_advisors",
        departmentId: "SUPPORT",
        roleName: "Runbook Advisors",
        description: "Suggest resolutions and update runbooks.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_support_runbook",
      },
    ],
  },
  {
    departmentId: "SUPPORT",
    tier: "FULL",
    label: "Support FULL",
    agents: [
      {
        key: "support_ticket_routers",
        departmentId: "SUPPORT",
        roleName: "Ticket Routers",
        description: "Route incoming tickets and requests.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_support",
      },
      {
        key: "support_runbook_advisors",
        departmentId: "SUPPORT",
        roleName: "Runbook Advisors",
        description: "Suggest resolutions and update runbooks.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_support_runbook",
      },
      {
        key: "support_sla_supervisors",
        departmentId: "SUPPORT",
        roleName: "SLA Supervisors",
        description: "Monitor response times and SLA risks.",
        aiProfile: { tier: "PREMIUM" },
        coreAgentId: "core_agent_support_supervisor",
      },
    ],
  },
  {
    departmentId: "EMAIL_INTAKE",
    tier: "BASIC",
    label: "Email Intake BASIC",
    agents: [
      {
        key: "email_intake_triagers",
        departmentId: "EMAIL_INTAKE",
        roleName: "Email Intake Triagers",
        description: "Classify inbound email and WhatsApp intake.",
        aiProfile: { tier: "LOW_COST" },
        coreAgentId: "core_agent_support",
      },
    ],
  },
  {
    departmentId: "EMAIL_INTAKE",
    tier: "STANDARD",
    label: "Email Intake STANDARD",
    agents: [
      {
        key: "email_intake_triagers",
        departmentId: "EMAIL_INTAKE",
        roleName: "Email Intake Triagers",
        description: "Classify inbound email and WhatsApp intake.",
        aiProfile: { tier: "LOW_COST" },
        coreAgentId: "core_agent_support",
      },
      {
        key: "email_intake_runbook_advisors",
        departmentId: "EMAIL_INTAKE",
        roleName: "Email Intake Runbook Advisors",
        description: "Suggest runbook replies and handoffs.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_support_runbook",
      },
    ],
  },
  {
    departmentId: "EMAIL_INTAKE",
    tier: "FULL",
    label: "Email Intake FULL",
    agents: [
      {
        key: "email_intake_triagers",
        departmentId: "EMAIL_INTAKE",
        roleName: "Email Intake Triagers",
        description: "Classify inbound email and WhatsApp intake.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_support",
      },
      {
        key: "email_intake_runbook_advisors",
        departmentId: "EMAIL_INTAKE",
        roleName: "Email Intake Runbook Advisors",
        description: "Suggest runbook replies and handoffs.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_support_runbook",
      },
      {
        key: "email_intake_sla_supervisors",
        departmentId: "EMAIL_INTAKE",
        roleName: "Email Intake SLA Supervisors",
        description: "Monitor SLA for inbound workflows.",
        aiProfile: { tier: "PREMIUM" },
        coreAgentId: "core_agent_support_supervisor",
      },
    ],
  },
  {
    departmentId: "OPS",
    tier: "BASIC",
    label: "Ops BASIC",
    agents: [
      {
        key: "ops_schedule_operators",
        departmentId: "OPS",
        roleName: "Schedule Operators",
        description: "Maintain daily schedules and checklists.",
        aiProfile: { tier: "LOW_COST" },
        coreAgentId: "core_agent_support_runbook",
      },
    ],
  },
  {
    departmentId: "OPS",
    tier: "STANDARD",
    label: "Ops STANDARD",
    agents: [
      {
        key: "ops_schedule_operators",
        departmentId: "OPS",
        roleName: "Schedule Operators",
        description: "Maintain daily schedules and checklists.",
        aiProfile: { tier: "LOW_COST" },
        coreAgentId: "core_agent_support_runbook",
      },
      {
        key: "ops_sla_supervisors",
        departmentId: "OPS",
        roleName: "Ops SLA Supervisors",
        description: "Track SLA and operational throughput.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_support_supervisor",
      },
    ],
  },
  {
    departmentId: "OPS",
    tier: "FULL",
    label: "Ops FULL",
    agents: [
      {
        key: "ops_schedule_operators",
        departmentId: "OPS",
        roleName: "Schedule Operators",
        description: "Maintain daily schedules and checklists.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_support_runbook",
      },
      {
        key: "ops_sla_supervisors",
        departmentId: "OPS",
        roleName: "Ops SLA Supervisors",
        description: "Track SLA and operational throughput.",
        aiProfile: { tier: "PREMIUM" },
        coreAgentId: "core_agent_support_supervisor",
      },
    ],
  },
  {
    departmentId: "TAX",
    tier: "BASIC",
    label: "Tax BASIC",
    agents: [
      {
        key: "tax_compliance_supervisors",
        departmentId: "TAX",
        roleName: "Tax Compliance Supervisors",
        description: "Monitor tax compliance and filings.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_tax",
      },
    ],
  },
  {
    departmentId: "TAX",
    tier: "STANDARD",
    label: "Tax STANDARD",
    agents: [
      {
        key: "tax_compliance_supervisors",
        departmentId: "TAX",
        roleName: "Tax Compliance Supervisors",
        description: "Monitor tax compliance and filings.",
        aiProfile: { tier: "BALANCED" },
        coreAgentId: "core_agent_tax",
      },
    ],
  },
  {
    departmentId: "TAX",
    tier: "FULL",
    label: "Tax FULL",
    agents: [
      {
        key: "tax_compliance_supervisors",
        departmentId: "TAX",
        roleName: "Tax Compliance Supervisors",
        description: "Monitor tax compliance and filings.",
        aiProfile: { tier: "PREMIUM" },
        coreAgentId: "core_agent_tax",
      },
    ],
  },
];
