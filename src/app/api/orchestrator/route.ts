import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { executeProvisioningPlaybookForSaaS } from "@/lib/provisioning-playbook";
import { authorizeSaasAccess, requireTenant } from "@/lib/authz/saas-access";
import { UnauthorizedError } from "@/lib/auth/session";
import { env, type DracoEnv } from "@/lib/cf";
import { ensureCampamentoBase, getCampamentoCoreAgentsCatalog, getCampamentoCoreDepartmentsCatalog } from "@/lib/campamento-base";
import { listDemoSaas, listDemoClients } from "@/lib/admin/demo-data";
import { DEV_ARCHITECT_AGENT } from "@/lib/dev-architects/agent";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { createOrMergeActionFromWebhook } from "@/lib/owner/action-queue-repository";
import { extractClientIp } from "@/lib/security/rate-limit";
import {
  buildCircuitBreakerKey,
  buildMonthlyUsageKey,
  bumpAiAbuseCounter,
  canAttemptHalfOpen,
  consumeAiRateLimit,
  estimateTokensForPrompt,
  getAiGovernanceConfig,
  getCircuitBreaker,
  getUsageCounter,
  incrementUsageCounter,
  isCircuitOpen,
  recordCircuitBreakerFailure,
  recordCircuitBreakerSuccess,
  transitionBreakerToHalfOpen,
} from "@/lib/orchestrator/ai-governance";
import { getCompanyFeatures, type CompanyFeaturesResult } from "@/lib/features/repository";
import type { SaasFeature } from "@/lib/features/types";
import type { SaasPackDefinition } from "@/lib/packs/types";
import { getCompanyPacks, listSaasPacks } from "@/lib/packs/repository";
import type { CompanyRecord } from "@/lib/companies/companies";
import { listCompanies } from "@/lib/companies/companies";

import {
  listDevArchitectProjects,
  listDevArchitectSessions,
  listDevArchitectChecklists,
  buildDevArchitectProjectMetrics,
  listDevArchitectTasks,
} from "@/lib/dev-architects/store";
import type {
  DevArchitectChecklist,
  DevArchitectMode,
  DevArchitectProject,
  DevArchitectProjectMetrics,
  DevArchitectSession,
  DevArchitectTask,
} from "@/lib/dev-architects/types";
// export const runtime = "edge"; // OpenNext Migration


function readProcessEnv(key: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const value = process.env[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function resolveOrchestratorModel(bindings: DracoEnv | null): string {
  const processModel = readProcessEnv("ORCHESTRATOR_MODEL");
  const configuredModel = bindings?.ORCHESTRATOR_MODEL ?? processModel ?? "";
  return configuredModel && configuredModel.trim().length > 0
    ? configuredModel.trim()
    : "accounts/fireworks/models/firefunction-v1";
}


type MessageRow = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: string | null;
  created_at: string;
};

type ContextInfo = {
  path?: string;
  scope?: "saas" | "inbox" | "devarchitect";
  company?: {
    id: string;
    name: string | null;
    slug: string | null;
  } | null;
  saas?: {
    id: string;
    name: string;
    slug: string;
    domain: string | null;
    subdomain?: string | null;
    status: string;
    client?: {
      id: string;
      name: string;
      nif: string | null;
      email: string | null;
    } | null;
    social_accounts?: {
      platform: string;
      handle: string | null;
      url: string | null;
      connected?: boolean;
    }[];
  };
  detalle?: {
    provisiones?: { id: string; paso: string; estado: string; creado: string; detalles?: string | null }[];
    alertas?: { id: string; severidad: string; fuente: string; mensaje: string; creado: string }[];
    agentes?: { id: string; nombre: string; departamento: string; departamento_id?: string; estado: string }[];
  };
  inbox?: {
    id: string;
    channel: string;
    status: string;
    department_id: string | null;
    department_label?: string | null;
    subject: string | null;
    preview: string;
    saas_id: string | null;
    saas_name?: string | null;
  };
  devArchitect?: {
    projects?: DevArchitectProject[];
    sessions?: DevArchitectSession[];
    checklists?: DevArchitectChecklist[];
    metrics?: DevArchitectProjectMetrics[];
    tasks?: DevArchitectTask[];
    taskCounts?: {
      todo: number;
      in_progress: number;
      done: number;
      blocked: number;
    };
    activeProjectId?: string;
    mode?: DevArchitectMode;
  };
  agentId?: string;
};

type OrchestratorCoreDepartment = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  es_critico: number;
};

type OrchestratorCoreAgent = {
  id: string;
  department_id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
};

type OrchestratorActiveAgent = {
  id: string;
  name: string;
  department_id: string | null;
  provider: string | null;
  model: string | null;
  active: boolean;
  created_at?: string;
};

type OrchestratorAlert = {
  id: string;
  severity: string;
  source: string;
  department_id?: string | null;
  saas_id?: string | null;
  message: string;
  created_at: string;
};

type OrchestratorSaasSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  domain: string | null;
  subdomain: string | null;
};

type OrchestratorClientSummary = {
  id: string;
  name: string;
  nif: string | null;
  email: string | null;
};

type OrchestratorInboxSummary = {
  total: number;
  byStatus: Record<string, number>;
};

type OrchestratorDevArchitectContext = {
  projects: DevArchitectProject[];
  sessions: DevArchitectSession[];
  checklists: DevArchitectChecklist[];
  metrics: DevArchitectProjectMetrics[];
  tasks: DevArchitectTask[];
  taskCounts: {
    todo: number;
    in_progress: number;
    done: number;
    blocked: number;
  };
  activeProjectId?: string;
  mode?: DevArchitectMode;
};

type OrchestratorMetricsSummary = {
  totalCoreDepartments: number;
  totalCoreAgents: number;
  totalActiveAgents: number;
  totalInactiveAgents: number;
  alertsCritical: number;
  alertsHigh: number;
  alertsMedium: number;
  alertsLow: number;
  alertsTotal: number;
  saasCount: number;
  clientsCount: number;
};

type OrchestratorContextEnvelope = {
  tenantId: string;
  path: string | null;
  panelContext: ContextInfo | null;
  generatedAt: string;
  coreDepartments: OrchestratorCoreDepartment[];
  coreAgents: OrchestratorCoreAgent[];
  activeAgents: OrchestratorActiveAgent[];
  alerts: OrchestratorAlert[];
  metrics: OrchestratorMetricsSummary;
  inbox: OrchestratorInboxSummary;
  saas: OrchestratorSaasSummary[];
  clients: OrchestratorClientSummary[];
  company?: CompanyRecord | null;
  companyFeatures?: SaasFeature[];
  companyPacks?: SaasPackDefinition[];
  companyResolvedSaasId?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  saas_id?: string | null;
  devarchitect?: OrchestratorDevArchitectContext;
  contextError?: boolean;
  contextErrorMessage?: string;
};

function createDemoAlerts(tenantId: string): OrchestratorAlert[] {
  const now = Date.now();
  return [
    {
      id: `alert_${tenantId}_critical_support`,
      severity: "critical",
      source: "core_support:sla",
      department_id: "core_support",
      saas_id: null,
      message: "Backlog de soporte supera el SLA acordado en las últimas 2 horas.",
      created_at: new Date(now - 1000 * 60 * 8).toISOString(),
    },
    {
      id: `alert_${tenantId}_high_finance`,
      severity: "high",
      source: "core_acc:cashflow",
      department_id: "core_acc",
      saas_id: null,
      message: "Variación negativa de cashflow del 12% respecto al día anterior.",
      created_at: new Date(now - 1000 * 60 * 22).toISOString(),
    },
    {
      id: `alert_${tenantId}_medium_mkt`,
      severity: "medium",
      source: "core_mkt:campaign",
      department_id: "core_mkt",
      saas_id: null,
      message: "La campaña de captación en redes sociales necesita revisión de creatividades.",
      created_at: new Date(now - 1000 * 60 * 37).toISOString(),
    },
  ];
}

function buildDemoActiveAgents(coreAgents: OrchestratorCoreAgent[]): OrchestratorActiveAgent[] {
  return coreAgents.slice(0, 6).map((agent, index) => ({
    id: `agent_demo_${agent.id}`,
    name: agent.nombre,
    department_id: agent.department_id,
    provider: index % 2 === 0 ? "Fireworks" : "DeepSeek",
    model: index % 2 === 0 ? "fireworks-mixtral-8x7b" : "deepseek-r1",
    active: index % 4 !== 0,
    created_at: new Date(Date.now() - index * 1000 * 60 * 55).toISOString(),
  }));
}

function summarizeTaskCounts(tasks: DevArchitectTask[]) {
  return tasks.reduce(
    (acc, task) => {
      if (task.status === "todo") acc.todo += 1;
      else if (task.status === "in_progress") acc.in_progress += 1;
      else if (task.status === "done") acc.done += 1;
      else if (task.status === "blocked") acc.blocked += 1;
      return acc;
    },
    { todo: 0, in_progress: 0, done: 0, blocked: 0 },
  );
}

async function buildDevArchitectContext({ tenantId, bindings, panelContext, }: { tenantId: string; bindings: DracoEnv | null; panelContext: ContextInfo | null; }): Promise<{ context?: OrchestratorDevArchitectContext; errors: string[] }> {
  if (!panelContext || panelContext.scope !== "devarchitect") {
    return { errors: [] };
  }
  const errors: string[] = [];
  let projects: DevArchitectProject[] = [];
  try {
    projects = await listDevArchitectProjects(tenantId, bindings);
  } catch {
    errors.push("devarchitect projects query failed");
  }
  let sessions: DevArchitectSession[] = [];
  try {
    sessions = await listDevArchitectSessions(tenantId, bindings, undefined);
  } catch {
    errors.push("devarchitect sessions query failed");
  }
  const checklists: DevArchitectChecklist[] = [];
  if (projects.length > 0) {
    const checklistResults = await Promise.allSettled(
      projects.map((project) => listDevArchitectChecklists(tenantId, bindings, project.id)),
    );
    checklistResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        checklists.push(...result.value);
      } else {
        errors.push(`devarchitect checklists query failed (${projects[index]?.id ?? "unknown"})`);
      }
    });
  }
  const requestedActiveId = panelContext.devArchitect?.activeProjectId;
  const activeProjectId = requestedActiveId && projects.some((project) => project.id === requestedActiveId)
    ? requestedActiveId
    : projects[0]?.id;
  let metrics: DevArchitectProjectMetrics[] = [];
  if (projects.length > 0) {
    try {
      metrics = await buildDevArchitectProjectMetrics({
        tenantId,
        bindings,
        projects,
        sessions,
        checklists,
      });
    } catch {
      errors.push("devarchitect metrics query failed");
    }
  }
  let tasks: DevArchitectTask[] = [];
  if (activeProjectId) {
    try {
      tasks = await listDevArchitectTasks(tenantId, bindings, { projectId: activeProjectId });
    } catch {
      errors.push("devarchitect tasks query failed");
    }
  }
  const taskCounts = summarizeTaskCounts(tasks);
  return {
    context: {
      projects,
      sessions,
      checklists,
      metrics,
      tasks,
      taskCounts,
      activeProjectId,
      mode: panelContext.devArchitect?.mode,
    },
    errors,
  };
}

async function buildOrchestratorContext({
  tenantId,
  path,
  panelContext,
  bindings,
}: {
  tenantId: string;
  path: string | null;
  panelContext: ContextInfo | null;
  bindings: DracoEnv | null;
}): Promise<OrchestratorContextEnvelope> {
  const coreDepartmentsFallback = getCampamentoCoreDepartmentsCatalog();
  const coreAgentsFallback = getCampamentoCoreAgentsCatalog();

  const base: OrchestratorContextEnvelope = {
    tenantId,
    path,
    panelContext,
    generatedAt: new Date().toISOString(),
    coreDepartments: [],
    coreAgents: [],
    activeAgents: [],
    alerts: [],
    metrics: {
      totalCoreDepartments: 0,
      totalCoreAgents: 0,
      totalActiveAgents: 0,
      totalInactiveAgents: 0,
      alertsCritical: 0,
      alertsHigh: 0,
      alertsMedium: 0,
      alertsLow: 0,
      alertsTotal: 0,
      saasCount: 0,
      clientsCount: 0,
    },
    inbox: { total: 0, byStatus: {} },
    saas: [],
    clients: [],
    company: null,
    companyFeatures: undefined,
    companyPacks: undefined,
    companyResolvedSaasId: null,
    company_id: null,
    company_name: null,
    saas_id: null,
  };

  if (!bindings || !bindings.DRACO_DB) {
    const demoAlerts = createDemoAlerts(tenantId);
    const demoSaas: OrchestratorSaasSummary[] = listDemoSaas(tenantId).map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      status: item.status,
      domain: item.domain,
      subdomain: item.subdomain,
    }));

    const demoClients: OrchestratorClientSummary[] = listDemoClients(tenantId).map((client) => ({
      id: client.id,
      name: client.name,
      nif: client.nif ?? null,
      email: client.email ?? null,
    }));

    const demoInbox: OrchestratorInboxSummary = {
      total: 18,
      byStatus: { nuevo: 6, en_proceso: 8, resuelto: 4 },
    };

    const activeAgents = buildDemoActiveAgents(coreAgentsFallback);

    const metrics: OrchestratorMetricsSummary = {
      totalCoreDepartments: coreDepartmentsFallback.length,
      totalCoreAgents: coreAgentsFallback.length,
      totalActiveAgents: activeAgents.filter((agent) => agent.active).length,
      totalInactiveAgents: activeAgents.filter((agent) => !agent.active).length,
      alertsCritical: demoAlerts.filter((alert) => alert.severity === "critical").length,
      alertsHigh: demoAlerts.filter((alert) => alert.severity === "high").length,
      alertsMedium: demoAlerts.filter((alert) => alert.severity === "medium").length,
      alertsLow: demoAlerts.filter((alert) => alert.severity === "low").length,
      alertsTotal: demoAlerts.length,
      saasCount: demoSaas.length,
      clientsCount: demoClients.length,
    };

    base.coreDepartments = coreDepartmentsFallback;
    base.coreAgents = coreAgentsFallback;
    base.activeAgents = activeAgents;
    base.alerts = demoAlerts;
    base.metrics = metrics;
    base.inbox = demoInbox;
    base.saas = demoSaas;
    base.clients = demoClients;

    if (panelContext?.scope === "devarchitect") {
      const { context: devContext, errors: devErrors } = await buildDevArchitectContext({ tenantId, bindings: null, panelContext });
      if (devContext) {
        base.devarchitect = devContext;
      }
      if (devErrors.length > 0) {
        base.contextError = true;
        base.contextErrorMessage = devErrors.join("; ");
      }
    }

    return base;
  }

  await ensureCampamentoBase();

  const contextErrors: string[] = [];

  const [
    coreDepartmentsResult,
    coreAgentsResult,
    activeAgentsResult,
    alertsResult,
    saasResult,
    clientsResult,
    inboxResult,
  ] = await Promise.allSettled([
    queryAll<OrchestratorCoreDepartment>(
      "SELECT id, slug, nombre, descripcion, es_critico FROM core_departments ORDER BY nombre",
    ),
    queryAll<OrchestratorCoreAgent>(
      "SELECT id, department_id, slug, nombre, descripcion, tipo FROM core_agents ORDER BY nombre",
    ),
    queryAll<{
      id: string;
      name: string;
      department_id: string | null;
      provider: string | null;
      model: string | null;
      active: number;
      created_at: string;
    }>(
      "SELECT id, name, department_id, provider, model, active, created_at FROM agents WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 100",
      tenantId,
    ),
    queryAll<OrchestratorAlert>(
      "SELECT id, severity, source, department_id, saas_id, message, created_at FROM alerts WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 100",
      tenantId,
    ),
    queryAll<OrchestratorSaasSummary>(
      "SELECT id, name, slug, status, domain, subdomain FROM saas WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 50",
      tenantId,
    ),
    queryAll<OrchestratorClientSummary>(
      "SELECT id, name, nif, email FROM clients WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 50",
      tenantId,
    ),
    queryAll<{ status: string; count: number }>(
      "SELECT status, COUNT(*) AS count FROM inbox_messages WHERE tenant_id = ? GROUP BY status",
      tenantId,
    ),
  ]);

  if (coreDepartmentsResult.status === "fulfilled" && coreDepartmentsResult.value.length > 0) {
    base.coreDepartments = coreDepartmentsResult.value;
  } else {
    base.coreDepartments = coreDepartmentsFallback;
    if (coreDepartmentsResult.status === "rejected") {
      contextErrors.push("core_departments query failed");
    }
  }

  if (coreAgentsResult.status === "fulfilled" && coreAgentsResult.value.length > 0) {
    base.coreAgents = coreAgentsResult.value;
  } else {
    base.coreAgents = coreAgentsFallback;
    if (coreAgentsResult.status === "rejected") {
      contextErrors.push("core_agents query failed");
    }
  }

  if (activeAgentsResult.status === "fulfilled") {
    base.activeAgents = activeAgentsResult.value.map((agent) => ({
      id: agent.id,
      name: agent.name,
      department_id: agent.department_id,
      provider: agent.provider,
      model: agent.model,
      active: agent.active === 1,
      created_at: agent.created_at,
    }));
  } else {
    base.activeAgents = buildDemoActiveAgents(base.coreAgents);
    contextErrors.push("agents query failed");
  }

  if (alertsResult.status === "fulfilled") {
    base.alerts = alertsResult.value.map((alert) => ({
      ...alert,
      created_at: alert.created_at,
    }));
  } else {
    base.alerts = createDemoAlerts(tenantId);
    contextErrors.push("alerts query failed");
  }

  if (saasResult.status === "fulfilled") {
    base.saas = saasResult.value;
  } else {
    base.saas = [
      {
        id: "saas_context_fallback",
        name: "SaaS demo",
        slug: "saas-demo",
        status: "operativo",
        domain: "demo.drako.systems",
        subdomain: null,
      },
    ];
    contextErrors.push("saas query failed");
  }

  if (clientsResult.status === "fulfilled") {
    base.clients = clientsResult.value;
  } else {
    base.clients = [
      { id: "client_context_fallback", name: "Cliente demo", nif: "CIF-DEMO", email: "cliente@demo.com" },
    ];
    contextErrors.push("clients query failed");
  }

  if (inboxResult.status === "fulfilled") {
    const summary: Record<string, number> = {};
    let total = 0;
    for (const row of inboxResult.value) {
      const status = row.status ?? "desconocido";
      const count = Number(row.count ?? 0);
      summary[status] = count;
      total += count;
    }
    base.inbox = { total, byStatus: summary };
  } else {
    base.inbox = { total: 0, byStatus: {} };
    contextErrors.push("inbox summary query failed");
  }

  const activeCount = base.activeAgents.filter((agent) => agent.active).length;
  const inactiveCount = base.activeAgents.length - activeCount;
  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;

  for (const alert of base.alerts) {
    const severity = (alert.severity ?? "").toLowerCase();
    if (severity === "critical" || severity === "error") {
      critical += 1;
    } else if (severity === "high" || severity === "warn" || severity === "warning") {
      high += 1;
    } else if (severity === "medium") {
      medium += 1;
    } else if (severity === "low" || severity === "info") {
      low += 1;
    }
  }

  base.metrics = {
    totalCoreDepartments: base.coreDepartments.length,
    totalCoreAgents: base.coreAgents.length,
    totalActiveAgents: activeCount,
    totalInactiveAgents: inactiveCount,
    alertsCritical: critical,
    alertsHigh: high,
    alertsMedium: medium,
    alertsLow: low,
    alertsTotal: base.alerts.length,
    saasCount: base.saas.length,
    clientsCount: base.clients.length,
  };

  if (panelContext?.scope === "devarchitect") {
    const { context: devContext, errors: devErrors } = await buildDevArchitectContext({ tenantId, bindings, panelContext });
    if (devContext) {
      base.devarchitect = devContext;
    }
    if (devErrors.length > 0) {
      contextErrors.push(...devErrors);
    }
  }

  let companyId: string | null = null;
  let companyName: string | null = null;
  let companySlug: string | null = null;
  if (panelContext?.company?.id) {
    companyId = panelContext.company.id;
    companyName = panelContext.company.name ?? null;
    companySlug = panelContext.company.slug ?? null;
  } else if (panelContext?.scope === "inbox") {
    companyId = (panelContext.inbox as { company_id?: string | null } | undefined)?.company_id ?? null;
  } else if (panelContext?.scope === "saas") {
    companyId = panelContext.saas?.id ?? null;
  }

  const fallbackSaasId = panelContext?.saas?.id ?? null;

  let companyRecord: CompanyRecord | null = null;
  if (companyId) {
    try {
      const companies = await listCompanies();
      companyRecord = companies.find((item) => item.id === companyId) ?? null;
      if (companyRecord) {
        companyName = companyRecord.name;
        companySlug = companyRecord.slug;
      }
    } catch (error) {
      console.error("ORCHESTRATOR_COMPANY_QUERY_ERROR", error);
      contextErrors.push("company query failed");
    }
  }

  let companyResolvedSaasId: string | null = null;
  let companyFeatures: SaasFeature[] | undefined;
  let companyPacks: SaasPackDefinition[] | undefined;
  let featureResult: CompanyFeaturesResult | null = null;
  if (companyId || fallbackSaasId) {
    try {
      featureResult = await getCompanyFeatures({ tenantId, companyId, saasId: fallbackSaasId, env: bindings ?? null });
      companyResolvedSaasId = featureResult.resolvedSaasId;
      companyFeatures = featureResult.items;
    } catch (error) {
      console.error("ORCHESTRATOR_COMPANY_FEATURES_ERROR", error);
      contextErrors.push("company features query failed");
    }

    try {
      const packResult = await getCompanyPacks({
        tenantId,
        companyId,
        saasId: fallbackSaasId,
        env: bindings ?? null,
        featureResult: featureResult ?? undefined,
      });
      companyPacks = packResult.items;
      companyResolvedSaasId = companyResolvedSaasId ?? packResult.resolvedSaasId;
    } catch (error) {
      console.error("ORCHESTRATOR_COMPANY_PACKS_ERROR", error);
      contextErrors.push("company packs query failed");
      if (!companyPacks) {
        companyPacks = listSaasPacks();
      }
    }
  } else if (panelContext?.saas?.id) {
    companyPacks = listSaasPacks();
  }

  if (panelContext) {
    base.panelContext = {
      ...panelContext,
      company: companyId
        ? {
          id: companyId,
          name: companyName,
          slug: companySlug,
        }
        : panelContext.company ?? null,
    };
  }
  base.company = companyRecord;
  base.companyFeatures = companyFeatures;
  base.companyPacks = companyPacks;
  base.companyResolvedSaasId = companyResolvedSaasId;
  base.company_id = companyId;
  base.company_name = companyName;
  base.saas_id = companyResolvedSaasId ?? fallbackSaasId;

  if (contextErrors.length > 0) {
    base.contextError = true;
    base.contextErrorMessage = contextErrors.join("; ");
  }

  return base;
}

const ORCHESTRATOR_SYSTEM_PROMPT = `Eres **DRĀKO.ChatOrchestrator**, la IA operativa del panel Campamento base de Drako.Systems.

Tu misión es actuar como socio estratégico del operador usando el contexto estructurado que recibes en 'orchestratorContext' para entender el estado del tenant y de sus SaaS:
- Departamentos base y su criticidad.
- Catálogo de agentes IA (coreAgents).
- Agentes activos del tenant y su distribución por departamento.
- Alertas recientes (severity, source, departamento afectado, tiempo).
- SaaS y clientes activos vinculados al tenant.
- Cualquier métrica global que venga en el contexto.

REGLAS DE ESTILO
- Responde SIEMPRE en español.
- Tono: conversacional, directo, de compañero de operaciones. Ni excesivamente formal ni servil.
- Habla como si trabajases dentro del panel, viendo los mismos datos que el operador.
- Puedes usar términos como “Campamento base”, “departamentos”, “agentes”, “bandeja”, “SaaS”, pero sin hablar de tablas SQL ni detalles internos de la base de datos.

CÓMO USAR EL CONTEXTO
- Siempre que recibas un nuevo mensaje:
  1. Lee y entiende el 'orchestratorContext' (resumen JSON que te envía el backend).
  2. Sitúa al usuario en 1–3 frases solo si es relevante: por ejemplo, número de agentes activos, departamentos con más carga, alerts críticas abiertas, etc.
  3. Responde a la petición apoyándote en datos concretos.
- Nunca inventes datos que no estén en el contexto. Si algo no existe o está vacío, dilo claramente y ofrece acciones alternativas.

TIPOS DE PETICIONES
- Preguntas de estado (agentes, departamentos, alertas, bandeja...).
- Peticiones de acción (no ejecutas tú la acción, propones plan): devuelve siempre un plan operativo paso a paso.
- Tiene en cuenta 'path' actual (p. ej. /agents, /departments, /metrics, /inbox) para enfocar tus respuestas.

CONDICIONES ESPECIALES
- Si 'orchestratorContext' viene vacío o marcado con 'contextError', dilo en una frase y actúa en modo genérico. Explica qué datos esperas y sugiere pasos para corregirlo.
- No preguntes por detalles de implementación técnica (Cloudflare, D1, Workers, etc.). Céntrate en negocio, operaciones y decisiones.

Tu objetivo es que el operador sienta que tiene a su lado a un socio que conoce el estado del sistema, señala riesgos y prioridades, y propone siguientes pasos concretos.`;

const ORCHESTRATOR_RESPONSE_GUARDRAILS = `Cuando 'orchestratorContext' incluya SaaS, agentes activos, alertas o métricas, cita siempre los números concretos y los departamentos implicados. Si alguna sección está vacía (por ejemplo SaaS, alerts o clientes), dilo explícitamente con frases como "Ahora mismo no tienes ningún SaaS registrado en este tenant" antes de sugerir acciones. Usa cada respuesta para conectar el contexto con la petición del operador, evitando cualquier texto genérico.`;
const ORCHESTRATOR_FALLBACK_MESSAGE = "No he podido contactar con el motor de IA. Intenta de nuevo en unos segundos.";

function buildDevArchitectContextSummary(context?: OrchestratorDevArchitectContext | null): string | null {
  if (!context) {
    return null;
  }
  if (!context.projects || context.projects.length === 0) {
    return "No hay proyectos DevArchitect registrados para este tenant.";
  }
  const projects = context.projects ?? [];
  const tasks = context.tasks ?? [];
  const activeProject = projects.find((project) => project.id === context.activeProjectId) ?? projects[0];
  const counts = context.taskCounts ?? summarizeTaskCounts(tasks);
  const metricsEntry = context.metrics?.find((metric) => metric.project_id === activeProject?.id);
  const checklistPendings = (context.checklists ?? []).filter(
    (item) => item.project_id === activeProject?.id && item.status === "pending",
  );
  const priorityWeight: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
  const urgentTasks = tasks
    .filter((task) => task.priority === "high" || task.priority === "urgent")
    .sort((a, b) => (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0))
    .slice(0, 3)
    .map((task) => `${task.title} (${task.priority}/${task.status})`);

  const summaryParts: string[] = [];
  if (activeProject) {
    summaryParts.push(
      `Proyecto activo: ${activeProject.name} (${activeProject.type}) • Estado ${activeProject.status}${activeProject.branch_name ? ` • Rama ${activeProject.branch_name}` : ""
      }${activeProject.last_build_status ? ` • Build ${activeProject.last_build_status}` : ""}.`,
    );
  }
  summaryParts.push(
    `Backlog: TODO ${counts.todo}, EN CURSO ${counts.in_progress}, BLOQUEADAS ${counts.blocked}, DONE ${counts.done}.`,
  );
  if (urgentTasks.length > 0) {
    summaryParts.push(`Tareas críticas: ${urgentTasks.join("; ")}.`);
  }
  if (metricsEntry) {
    const alertSummary = [`Alertas abiertas ${metricsEntry.alerts_open}`];
    if (metricsEntry.max_severity) {
      alertSummary.push(`severidad máx ${metricsEntry.max_severity.toUpperCase()}`);
    }
    summaryParts.push(`Métricas: ${alertSummary.join(" • ")}.`);
    const auditPieces: string[] = [];
    if (metricsEntry.last_audit_at) {
      auditPieces.push(`Última auditoría ${metricsEntry.last_audit_at}`);
    }
    if (metricsEntry.last_audit_status) {
      auditPieces.push(`estado ${metricsEntry.last_audit_status}`);
    }
    auditPieces.push(`reglas OK ${metricsEntry.total_rules_ok}`, `pendientes ${metricsEntry.total_rules_pending}`);
    summaryParts.push(`Auditoría OLIMPO: ${auditPieces.join(" • ")}.`);
  }
  if (checklistPendings.length > 0) {
    const labels = checklistPendings.map((item) => item.label);
    const preview = labels.slice(0, 4).join(", ");
    const suffix = labels.length > 4 ? ", ..." : "";
    summaryParts.push(`Reglas pendientes: ${preview}${suffix}.`);
  }
  return summaryParts.join("\n");
}

function buildSystemPromptForAgent({
  basePrompt,
  guardrails,
  agentId,
  devContext,
}: {
  basePrompt: string;
  guardrails: string;
  agentId?: string | null;
  devContext?: OrchestratorDevArchitectContext | null;
}): string {
  const sections = [basePrompt.trim(), guardrails.trim()];
  if (agentId === DEV_ARCHITECT_AGENT.id) {
    sections.push(
      `PERFIL DEL AGENTE ACTUAL: ${DEV_ARCHITECT_AGENT.name}

${DEV_ARCHITECT_AGENT.metaPrompt}
SIGUE ESTAS REGLAS:
- No rompas la compilación ni cambies el stack tecnológico salvo instrucción expresa.
- Respeta la arquitectura actual de Campamento Base (Next.js + Cloudflare D1 + OLIMPO).
- Usa nombres en inglés y en plural para archivos, rutas y tipos nuevos.
- Antes de proponer cambios, explica en pocas líneas el plan y los archivos que revisarías.
- Prioriza mantener "npm run qa" en verde y consulta el backlog técnico antes de mover tareas.
- Usa las métricas, alertas y checklists para decidir prioridades y señalar riesgos.`,
    );
    const summary = buildDevArchitectContextSummary(devContext ?? null);
    if (summary) {
      sections.push(`CONTEXTO TÉCNICO ACTUAL (SOLO LECTURA):\n${summary}`);
    }
  }
  return sections
    .map((section) => section.trim())
    .filter((section) => section.length > 0)
    .join("\n\n");
}

type CallModelSuccess = { ok: true; reply: string; totalTokens?: number; model: string; provider: string };
type CallModelError = { ok: false; error: string; model: string; provider: string; reason?: "missing_key" | "http_error" | "exception" };

async function callOrchestratorModel({
  bindings,
  context,
  userMessage,
  agentId,
}: {
  bindings: DracoEnv | null;
  context: OrchestratorContextEnvelope;
  userMessage: string;
  agentId?: string | null;
}): Promise<CallModelSuccess | CallModelError> {
  const provider = "fireworks";
  const processApiKey = readProcessEnv("FIREWORKS_API_KEY");
  const apiKey = bindings?.FIREWORKS_API_KEY ?? processApiKey;
  const hasApiKey = Boolean(apiKey);
  if (!apiKey) {
    console.warn("ORCHESTRATOR_LLM_NO_API_KEY", {
      hasBindings: Boolean(bindings),
      hasProcessEnvKey: Boolean(processApiKey),
    });
    return { ok: false, error: "FIREWORKS_API_KEY not configured", model: "", provider, reason: "missing_key" };
  }

  const model = resolveOrchestratorModel(bindings);

  const contextJson = JSON.stringify(context, null, 2);
  const trimmedContext = contextJson.length > 18000 ? `${contextJson.slice(0, 18000)}\n... (context recortado)` : contextJson;
  const systemPrompt = buildSystemPromptForAgent({
    basePrompt: ORCHESTRATOR_SYSTEM_PROMPT,
    guardrails: ORCHESTRATOR_RESPONSE_GUARDRAILS,
    agentId,
    devContext: context.devarchitect ?? null,
  });

  try {
    const response = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 800,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "system", content: `Contexto JSON:\n${trimmedContext}` },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.warn("ORCHESTRATOR_LLM_HTTP_ERROR", {
        hasApiKey,
        status: response.status,
        bodySnippet: errorText.slice(0, 200),
      });
      return {
        ok: false,
        error: `Fireworks request failed (${response.status}): ${errorText}`,
        model,
        provider,
        reason: "http_error",
      };
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      console.warn("ORCHESTRATOR_LLM_EMPTY_RESPONSE", {
        hasApiKey,
        choices: data.choices?.length ?? 0,
      });
      return { ok: false, error: "Fireworks response sin contenido", model, provider, reason: "http_error" };
    }
    return { ok: true, reply: content, totalTokens: data.usage?.total_tokens, model, provider };
  } catch (error) {
    console.warn("ORCHESTRATOR_LLM_EXCEPTION", {
      hasApiKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Fireworks request exception",
      model,
      provider,
      reason: "exception",
    };
  }
}


function newId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}_${Date.now()}`;
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function estimateTokenCount(userMessage: string, assistantReply: string): number {
  const approxCharacters = (userMessage?.length ?? 0) + (assistantReply?.length ?? 0);
  return Math.max(1, Math.ceil(approxCharacters / 4));
}

function estimateCostInCents(tokenCount: number): number {
  const TOKEN_COST_USD = 0.000002; // aproximación para costo por token
  return Math.max(0, Math.round(tokenCount * TOKEN_COST_USD * 100));
}

function resolveCorrelationId(request: Request): string {
  return (
    request.headers.get("x-drako-correlation-id") ||
    request.headers.get("x-request-id") ||
    globalThis.crypto?.randomUUID?.() ||
    `corr_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
  );
}

async function recordAiEvent(params: {
  tenantId: string;
  saasId?: string | null;
  saasSlug?: string | null;
  type: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  correlationId: string;
  metadata?: Record<string, unknown>;
}) {
  await recordCampamentoEvent({
    tenantId: params.tenantId,
    saasId: params.saasId ?? null,
    type: params.type,
    severity: params.severity,
    source: "AI_ORCHESTRATOR",
    message: params.message,
    metadata: { saasSlug: params.saasSlug ?? null, ...params.metadata },
    correlationId: params.correlationId,
  });
}

async function createAiAction(params: {
  tenantId: string;
  saasId?: string | null;
  saasSlug?: string | null;
  priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  title: string;
  description: string;
  correlationId?: string;
  actionKey: string;
  metadata?: Record<string, unknown>;
}) {
  await createOrMergeActionFromWebhook({
    tenantId: params.tenantId,
    saasId: params.saasId ?? null,
    saasSlug: params.saasSlug ?? null,
    category: "RISK",
    priority: params.priority,
    title: params.title,
    description: params.description,
    source: "ai-orchestrator",
    actionKey: params.actionKey,
    metadata: params.metadata ?? null,
    correlationId: params.correlationId,
  });
}

async function recordOrchestratorMetric({
  tenantId,
  scope,
  tokenCount,
  costCents,
  roi,
}: {
  tenantId: string;
  scope: string;
  tokenCount: number;
  costCents: number;
  roi: number;
}) {
  await run(
    "INSERT INTO metrics (tenant_id, scope, token_count, ai_cost_cents, roi) VALUES (?, ?, ?, ?, ?)",
    tenantId,
    scope,
    tokenCount,
    costCents,
    roi,
  );
}

async function recordOrchestratorAlert({
  tenantId,
  severity,
  message,
  saasId,
}: {
  tenantId: string;
  severity: string;
  message: string;
  saasId?: string | null;
}) {
  const alertId = globalThis.crypto?.randomUUID?.() ?? `alert_${Date.now()}`;
  await run(
    "INSERT INTO alerts (id, tenant_id, severity, source, message, saas_id) VALUES (?, ?, ?, ?, ?, ?)",
    alertId,
    tenantId,
    severity,
    "orchestrator",
    message,
    saasId ?? null,
  );
}

function authErrorResponse(error: unknown) {
  if (error instanceof Error && error.message.includes("FORBIDDEN")) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  }
  return null;
}

function normalizePanelContext(
  base: ContextInfo | null,
  overrides: { scope?: ContextInfo["scope"]; agentId?: string; devProjectId?: string | null; devMode?: DevArchitectMode | null },
): ContextInfo | null {
  let context: ContextInfo | null = base ? { ...base } : null;

  if (overrides.scope && (!context || context.scope !== overrides.scope)) {
    context = context ? { ...context, scope: overrides.scope } : { scope: overrides.scope };
  }

  if (!context) return null;

  if (overrides.agentId) {
    context = { ...context, agentId: overrides.agentId };
  }

  if (context.scope === "devarchitect") {
    const devData = { ...(context.devArchitect ?? {}) };
    if (overrides.devProjectId) {
      devData.activeProjectId = overrides.devProjectId;
    }
    if (overrides.devMode) {
      devData.mode = overrides.devMode;
    }
    context = { ...context, devArchitect: devData };
  }

  return context;
}

export async function GET(req: Request) {
  try {
    const access = await authorizeSaasAccess({ headers: req.headers } as any);
    requireTenant(access);
    const tenantId = access.tenantId!;
    const url = new URL(req.url);
    const threadId = url.searchParams.get("thread_id");
    if (!threadId) {
      return NextResponse.json({ error: "thread_id requerido" }, { status: 400 });
    }
    // En entornos sin DRACO_DB (por ejemplo, npm run dev en Node), devolvemos
    // un historial vacío en lugar de romper con error de base de datos.
    if (!env()) {
      return NextResponse.json({ thread_id: threadId, items: [] satisfies MessageRow[] });
    }
    const items = await queryAll<MessageRow>(
      "SELECT id, thread_id, role, content, metadata, created_at FROM orchestrator_messages WHERE tenant_id = ? AND thread_id = ? ORDER BY created_at ASC",
      tenantId,
      threadId
    );
    return NextResponse.json({ thread_id: threadId, items });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("ORCHESTRATOR_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal orchestrator error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await authorizeSaasAccess({ headers: req.headers } as any);
    requireTenant(access);
    const tenantId = access.tenantId!;
    const body = (await req.json().catch(() => null)) as {
      thread_id?: string;
      message?: string;
      context?: ContextInfo;
      saasSlug?: string;
      scope?: ContextInfo["scope"];
      agentId?: string;
      devarchitectProjectId?: string;
      devarchitectMode?: DevArchitectMode;
    } | null;

    if (!body?.message || typeof body.message !== "string") {
      return NextResponse.json({ ok: false, error: "message requerido" }, { status: 400 });
    }
    const threadId = body.thread_id || newId("thread");
    const bindings = env();
    const panelContext = normalizePanelContext(body.context ?? null, {
      scope: body.scope,
      agentId: body.agentId,
      devProjectId: body.devarchitectProjectId ?? null,
      devMode: body.devarchitectMode ?? null,
    });
    const path = typeof panelContext?.path === "string" ? panelContext.path : null;
    const effectiveAgentId = panelContext?.agentId ?? body.agentId ?? null;
    const correlationId = resolveCorrelationId(req);
    const saasSlug =
      (typeof body.saasSlug === "string" && body.saasSlug.trim()) ||
      (panelContext?.scope === "saas" ? panelContext.saas?.slug : null) ||
      null;
    const config = getAiGovernanceConfig(bindings);
    const provider = "fireworks";
    const orchestratorContext = await buildOrchestratorContext({
      tenantId,
      path,
      panelContext,
      bindings,
    });
    const metadata = panelContext ? JSON.stringify(panelContext) : null;
    const assistantMetadata = JSON.stringify({ panelContext, orchestratorContext });
    const hasDatabase = Boolean(bindings?.DRACO_DB);
    const historyBuffer: MessageRow[] = [];
    const route = "/api/orchestrator";
    const ip = extractClientIp(req);
    const model = resolveOrchestratorModel(bindings);

    if (config.rateLimitEnabled) {
      const tenantLimit = await consumeAiRateLimit({
        tenantId,
        saasSlug: null,
        route,
        limit: config.rpmPerTenant,
        windowMs: 60_000,
        envOverride: bindings ?? null,
      });
      if (!tenantLimit.allowed) {
        await recordAiEvent({
          tenantId,
          saasId: null,
          saasSlug,
          type: "ai.ratelimit.blocked",
          severity: "WARNING",
          message: "AI rate limit blocked at tenant scope.",
          correlationId,
          metadata: { scope: "tenant", ip, limit: config.rpmPerTenant, count: tenantLimit.count, resetAt: tenantLimit.resetAt },
        });
        const abuse = await bumpAiAbuseCounter({
          key: `${tenantId}:${ip}:${route}`,
          threshold: 5,
          windowMs: 10 * 60_000,
          envOverride: bindings ?? null,
        });
        if (abuse.thresholdReached) {
          await createAiAction({
            tenantId,
            saasSlug,
            priority: "HIGH",
            title: "AI abuse suspected",
            description: "Repeated rate limit blocks detected for AI orchestrator.",
            actionKey: `ai_abuse:${tenantId}:${ip}:${route}`,
            correlationId,
            metadata: { ip, count: abuse.count },
          });
        }
        return NextResponse.json(
          { ok: false, error: "AI_RATE_LIMITED", retryAt: tenantLimit.resetAt },
          { status: 429, headers: { "Retry-After": "60" } },
        );
      }

      if (saasSlug) {
        const saasLimit = await consumeAiRateLimit({
          tenantId,
          saasSlug,
          route,
          limit: config.rpmPerSaas,
          windowMs: 60_000,
          envOverride: bindings ?? null,
        });
        if (!saasLimit.allowed) {
          await recordAiEvent({
            tenantId,
            saasId: null,
            saasSlug,
            type: "ai.ratelimit.blocked",
            severity: "WARNING",
            message: "AI rate limit blocked at SaaS scope.",
            correlationId,
            metadata: { scope: "saas", ip, limit: config.rpmPerSaas, count: saasLimit.count, resetAt: saasLimit.resetAt },
          });
          const abuse = await bumpAiAbuseCounter({
            key: `${tenantId}:${ip}:${route}`,
            threshold: 5,
            windowMs: 10 * 60_000,
            envOverride: bindings ?? null,
          });
          if (abuse.thresholdReached) {
            await createAiAction({
              tenantId,
              saasSlug,
              priority: "HIGH",
              title: "AI abuse suspected",
              description: "Repeated rate limit blocks detected for AI orchestrator.",
              actionKey: `ai_abuse:${tenantId}:${ip}:${route}`,
              correlationId,
              metadata: { ip, count: abuse.count },
            });
          }
          return NextResponse.json(
            { ok: false, error: "AI_RATE_LIMITED", retryAt: saasLimit.resetAt },
            { status: 429, headers: { "Retry-After": "60" } },
          );
        }
      }
    }

    const usageKey = buildMonthlyUsageKey({ tenantId, saasSlug });
    const usageSnapshot = await getUsageCounter({ key: usageKey, envOverride: bindings ?? null });
    const estimatedTokensIn = estimateTokensForPrompt(body.message);
    const projectedTokens = usageSnapshot.tokens_in + usageSnapshot.tokens_out + estimatedTokensIn;

    if (projectedTokens >= config.monthlyTokensHard) {
      await recordAiEvent({
        tenantId,
        saasId: null,
        saasSlug,
        type: "ai.quota.hard_blocked",
        severity: "CRITICAL",
        message: "AI hard quota blocked.",
        correlationId,
        metadata: { usageKey, projectedTokens, hardLimit: config.monthlyTokensHard },
      });
      await createAiAction({
        tenantId,
        saasSlug,
        priority: "CRITICAL",
        title: "AI hard quota blocked",
        description: "AI usage hit the hard monthly token limit.",
        actionKey: `ai_quota_hard:${usageKey}`,
        correlationId,
        metadata: { projectedTokens, hardLimit: config.monthlyTokensHard },
      });
      return NextResponse.json({ ok: false, error: "AI_QUOTA_HARD_LIMIT" }, { status: 402 });
    }

    if (projectedTokens >= config.monthlyTokensSoft) {
      await recordAiEvent({
        tenantId,
        saasId: null,
        saasSlug,
        type: "ai.quota.soft_exceeded",
        severity: "WARNING",
        message: "AI soft quota exceeded.",
        correlationId,
        metadata: { usageKey, projectedTokens, softLimit: config.monthlyTokensSoft },
      });
      await createAiAction({
        tenantId,
        saasSlug,
        priority: "HIGH",
        title: "AI soft quota exceeded",
        description: "AI usage exceeded the soft monthly token threshold.",
        actionKey: `ai_quota_soft:${usageKey}`,
        correlationId,
        metadata: { projectedTokens, softLimit: config.monthlyTokensSoft },
      });
    }

    const hasApiKey = Boolean(bindings?.FIREWORKS_API_KEY ?? readProcessEnv("FIREWORKS_API_KEY"));
    const breakerKey = buildCircuitBreakerKey({ tenantId, saasSlug, provider });
    if (hasApiKey) {
      let breaker = await getCircuitBreaker({ key: breakerKey, envOverride: bindings ?? null });
      if (breaker.state === "OPEN" && isCircuitOpen(breaker)) {
        await recordAiEvent({
          tenantId,
          saasId: null,
          saasSlug,
          type: "ai.circuit.open",
          severity: "ERROR",
          message: "AI circuit open; request blocked.",
          correlationId,
          metadata: { provider, cooldownUntil: breaker.cooldown_until },
        });
        return NextResponse.json({ ok: false, error: "AI_CIRCUIT_OPEN" }, { status: 503 });
      }

      if (breaker.state === "OPEN" && !isCircuitOpen(breaker)) {
        breaker = await transitionBreakerToHalfOpen({ key: breakerKey, envOverride: bindings ?? null });
        await recordAiEvent({
          tenantId,
          saasId: null,
          saasSlug,
          type: "ai.circuit.half_open",
          severity: "WARNING",
          message: "AI circuit half-open; limited trials.",
          correlationId,
          metadata: { provider },
        });
      }

      if (breaker.state === "HALF_OPEN" && !canAttemptHalfOpen(breaker, config.breakerHalfOpenTrials)) {
        await recordCircuitBreakerFailure({
          key: breakerKey,
          threshold: 1,
          cooldownSeconds: config.breakerCooldownSeconds,
          error: "half_open_trials_exhausted",
          envOverride: bindings ?? null,
        });
        await recordAiEvent({
          tenantId,
          saasId: null,
          saasSlug,
          type: "ai.circuit.open",
          severity: "ERROR",
          message: "AI circuit re-opened; trials exhausted.",
          correlationId,
          metadata: { provider },
        });
        return NextResponse.json({ ok: false, error: "AI_CIRCUIT_OPEN" }, { status: 503 });
      }
    }

    const userMsgId = newId("msg");
    const userCreatedAt = new Date().toISOString();
    if (hasDatabase) {
      const okUser = await run(
        "INSERT INTO orchestrator_messages (id, tenant_id, thread_id, role, content, metadata) VALUES (?, ?, ?, 'user', ?, ?)",
        userMsgId,
        tenantId,
        threadId,
        body.message,
        metadata
      );
      if (!okUser) {
        return NextResponse.json({ ok: false, error: "error registrando mensaje" }, { status: 500 });
      }
    } else {
      historyBuffer.push({
        id: userMsgId,
        thread_id: threadId,
        role: "user",
        content: body.message,
        metadata,
        created_at: userCreatedAt,
      });
    }

    const normalizedText = normalize(body.message);
    let detectedSlug: string | null = null;
    if (typeof body.saasSlug === "string" && body.saasSlug.trim()) {
      detectedSlug = body.saasSlug.trim();
    } else {
      const slugMatch = /slug del saas[:\s]+([a-z0-9-\.]+)/i.exec(body.message);
      if (slugMatch?.[1]) {
        detectedSlug = slugMatch[1].trim();
      }
    }

    const shouldExecutePlaybook =
      !!detectedSlug && /(playbook|provision|dns|domain|cloudflare|ssl)/.test(normalizedText);

    let playbookResult: Awaited<ReturnType<typeof executeProvisioningPlaybookForSaaS>> | null = null;
    if (shouldExecutePlaybook && detectedSlug && hasDatabase) {
      playbookResult = await executeProvisioningPlaybookForSaaS({ saasSlug: detectedSlug, tenantId });
    }

    const requestStartedAt = Date.now();
    await recordAiEvent({
      tenantId,
      saasId: null,
      saasSlug,
      type: "ai.request.started",
      severity: "INFO",
      message: "AI request started.",
      correlationId,
      metadata: {
        provider,
        model,
        prompt_length: body.message.length,
        token_estimate: estimatedTokensIn,
      },
    });

    const llmResult = await callOrchestratorModel({
      bindings: bindings ?? null,
      context: orchestratorContext,
      userMessage: body.message,
      agentId: effectiveAgentId,
    });

    let reply: string;
    let llmTokens: number | null = null;
    if (llmResult.ok) {
      reply = llmResult.reply;
      llmTokens = llmResult.totalTokens ?? null;
    } else {
      console.error("ORCHESTRATOR_LLM_FALLBACK", llmResult.error);
      reply = ORCHESTRATOR_FALLBACK_MESSAGE;
    }

    const durationMs = Date.now() - requestStartedAt;
    const totalTokens = llmTokens ?? estimateTokenCount(body.message, reply);
    const tokensOut = Math.max(0, totalTokens - estimatedTokensIn);
    await incrementUsageCounter({
      key: usageKey,
      tokensIn: estimatedTokensIn,
      tokensOut: llmResult.ok ? tokensOut : 0,
      requests: 1,
      envOverride: bindings ?? null,
    });

    if (llmResult.ok) {
      if (hasApiKey) {
        const breakerUpdated = await recordCircuitBreakerSuccess({
          key: breakerKey,
          trials: config.breakerHalfOpenTrials,
          envOverride: bindings ?? null,
        });
        if (breakerUpdated.state === "CLOSED") {
          await recordAiEvent({
            tenantId,
            saasId: null,
            saasSlug,
            type: "ai.circuit.closed",
            severity: "INFO",
            message: "AI circuit closed after successful trials.",
            correlationId,
            metadata: { provider },
          });
        }
      }
      await recordAiEvent({
        tenantId,
        saasId: null,
        saasSlug,
        type: "ai.request.completed",
        severity: "INFO",
        message: "AI request completed.",
        correlationId,
        metadata: {
          provider,
          model,
          duration_ms: durationMs,
          token_total: totalTokens,
          token_estimate: estimatedTokensIn,
          status: "ok",
        },
      });
    } else {
      if (hasApiKey && llmResult.reason !== "missing_key") {
        const failure = await recordCircuitBreakerFailure({
          key: breakerKey,
          threshold: config.breakerFailureThreshold,
          cooldownSeconds: config.breakerCooldownSeconds,
          error: llmResult.error,
          envOverride: bindings ?? null,
        });
        if (failure.opened) {
          await recordAiEvent({
            tenantId,
            saasId: null,
            saasSlug,
            type: "ai.circuit.open",
            severity: "ERROR",
            message: "AI circuit opened after failures.",
            correlationId,
            metadata: { provider },
          });
          await createAiAction({
            tenantId,
            saasSlug,
            priority: "HIGH",
            title: "AI provider unstable",
            description: "AI provider is failing repeatedly; circuit opened.",
            actionKey: `ai_circuit_open:${breakerKey}`,
            correlationId,
            metadata: { provider },
          });
        }
      }
      await recordAiEvent({
        tenantId,
        saasId: null,
        saasSlug,
        type: "ai.request.failed",
        severity: "ERROR",
        message: "AI request failed.",
        correlationId,
        metadata: {
          provider,
          model,
          duration_ms: durationMs,
          error: llmResult.error,
          status: "error",
        },
      });
    }

    if (playbookResult?.ok) {
      reply = `${reply}

He registrado los pasos base de provisión (DNS + SSL, conexión a Pages y verificación de certificados) para el SaaS con slug ${playbookResult.saasSlug}. El estado actual del SaaS es '${playbookResult.newStatus}'.`;
    }

    const assistantMsgId = newId("msg");
    const assistantCreatedAt = new Date().toISOString();
    if (hasDatabase) {
      const okAssistant = await run(
        "INSERT INTO orchestrator_messages (id, tenant_id, thread_id, role, content, metadata) VALUES (?, ?, ?, 'assistant', ?, ?)",
        assistantMsgId,
        tenantId,
        threadId,
        reply,
        assistantMetadata
      );
      if (!okAssistant) {
        return NextResponse.json({ ok: false, error: "error registrando respuesta" }, { status: 500 });
      }
    } else {
      historyBuffer.push({
        id: assistantMsgId,
        thread_id: threadId,
        role: "assistant",
        content: reply,
        metadata: assistantMetadata,
        created_at: assistantCreatedAt,
      });
    }

    if (hasDatabase) {
      const scope = body.context?.scope ?? "orchestrator";
      const tokenCount = llmTokens ?? estimateTokenCount(body.message, reply);
      const costCents = estimateCostInCents(tokenCount);
      const roi = playbookResult?.ok ? 1 : 0;
      await recordOrchestratorMetric({ tenantId, scope, tokenCount, costCents, roi });

      if (playbookResult?.ok) {
        await recordOrchestratorAlert({
          tenantId,
          severity: "info",
          message: `Playbook ejecutado para el SaaS ${playbookResult.saasSlug} (estado ${playbookResult.newStatus}).`,
          saasId: playbookResult.saasSlug ?? body.context?.inbox?.saas_id ?? null,
        });
      } else if (playbookResult && !playbookResult.ok) {
        await recordOrchestratorAlert({
          tenantId,
          severity: "error",
          message: `Fallo al ejecutar playbook: ${playbookResult.error ?? "error desconocido"}`,
          saasId: body.context?.inbox?.saas_id ?? null,
        });
      } else if (body.context?.scope === "inbox" && body.context.inbox?.status === "error") {
        const inbox = body.context.inbox;
        const summary = inbox.subject ?? inbox.preview ?? "Mensaje en estado error";
        await recordOrchestratorAlert({
          tenantId,
          severity: "warning",
          message: `Inbox ${inbox.id} permanece en estado error: ${summary}`,
          saasId: inbox.saas_id ?? null,
        });
      }
    }

    const items = hasDatabase
      ? await queryAll<MessageRow>(
        "SELECT id, thread_id, role, content, metadata, created_at FROM orchestrator_messages WHERE tenant_id = ? AND thread_id = ? ORDER BY created_at ASC",
        tenantId,
        threadId
      )
      : historyBuffer;

    if (playbookResult?.ok) {
      return NextResponse.json({
        ok: true,
        mode: "provisioning_playbook_executed",
        thread_id: threadId,
        reply,
        items,
        saasSlug: playbookResult.saasSlug,
        newStatus: playbookResult.newStatus,
        steps: playbookResult.steps,
        orchestratorContext,
      });
    }

    if (playbookResult && !playbookResult.ok) {
      return NextResponse.json({
        ok: false,
        mode: "provisioning_playbook_error",
        thread_id: threadId,
        reply,
        items,
        error: playbookResult.error,
        orchestratorContext,
      }, { status: 400 });
    }

    return NextResponse.json({ ok: true, thread_id: threadId, reply, items, orchestratorContext });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("ORCHESTRATOR_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal orchestrator error" }, { status: 500 });
  }
}
