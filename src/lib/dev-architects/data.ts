import type {
  DevArchitectChecklist,
  DevArchitectMode,
  DevArchitectProject,
  DevArchitectSession,
} from "@/lib/dev-architects/types";

export const DEV_ARCHITECT_MODES: DevArchitectMode[] = ["Review", "Fix", "Refactor", "Guide"];

export type DevArchitectChecklistRule = {
  key: string;
  label: string;
  description: string;
};

export const DEV_ARCHITECT_CHECKLIST_RULES: DevArchitectChecklistRule[] = [
  {
    key: "naming",
    label: "Naming en inglés y en plural",
    description: "Todos los folders, rutas y tipos usan plural en inglés según OLIMPO.",
  },
  {
    key: "imports",
    label: "No dejar imports rotos",
    description: "Cada cambio debe validar imports y dependencias antes de push.",
  },
  {
    key: "runtime",
    label: "Validar edge/SSR antes de deploy",
    description: "Cualquier despliegue revisa compatibilidad edge/SSR y runtime híbrido.",
  },
  {
    key: "agents",
    label: "Revisar agents antes de activar",
    description: "Los agentes IA pasan por checklist operativo antes de habilitarse.",
  },
  {
    key: "build",
    label: "Guardian del build",
    description: "No se mergea nada si npm run qa no está en verde.",
  },
  {
    key: "memory",
    label: "Memoria de proyecto",
    description: "Cada sesión documenta contexto y decisiones clave.",
  },
];

export const DEV_ARCHITECT_PROJECT_TEMPLATES: DevArchitectProject[] = [
  {
    id: "campamento-base",
    name: "Campamento Base Core",
    type: "core",
    origin: "GitHub",
    origin_url: "https://github.com/drako-systems/campamento-base",
    branch_name: "main",
    status: "active",
    last_build_status: "OK",
    last_action_summary: "Sincronizó layout y métricas base",
  },
  {
    id: "agents-dashboard",
    name: "Agents Dashboard",
    type: "saas",
    origin: "GitHub",
    origin_url: "https://github.com/drako-systems/agents-dashboard",
    branch_name: "feature/runtime-sync",
    status: "pending",
    last_build_status: "Warning",
    last_action_summary: "Pendiente de alinear runtime edge",
  },
  {
    id: "metric-lab",
    name: "Metrics Lab",
    type: "experiment",
    origin: "Local",
    origin_url: "file://~/projects/metrics-lab",
    branch_name: "lab/telemetry-prototype",
    status: "broken",
    last_build_status: "Error",
    last_action_summary: "Fallo en pruebas de tracing OLIMPO",
  },
];

export const DEV_ARCHITECT_SESSION_TEMPLATES: DevArchitectSession[] = [
  {
    id: "session-campamento-base-1",
    project_id: "campamento-base",
    mode: "Review",
    title: "Revisión diaria del runtime edge",
    last_interaction_at: "2024-11-23T12:44:00.000Z",
    summary: null,
  },
  {
    id: "session-campamento-base-2",
    project_id: "campamento-base",
    mode: "Fix",
    title: "Corrección AgentsDashboardPage",
    last_interaction_at: "2024-11-22T18:10:00.000Z",
    summary: null,
  },
  {
    id: "session-agents-dashboard-1",
    project_id: "agents-dashboard",
    mode: "Refactor",
    title: "Refactor runtime compartido",
    last_interaction_at: "2024-11-21T09:00:00.000Z",
    summary: null,
  },
  {
    id: "session-metric-lab-1",
    project_id: "metric-lab",
    mode: "Guide",
    title: "Plan para telemetría OLIMPO",
    last_interaction_at: "2024-11-20T16:30:00.000Z",
    summary: null,
  },
];

export const DEV_ARCHITECT_CHECKLIST_TEMPLATES: DevArchitectChecklist[] = [
  { id: "naming-camp", project_id: "campamento-base", key: "naming", label: "Naming en inglés y en plural", status: "ok" },
  { id: "naming-agents", project_id: "agents-dashboard", key: "naming", label: "Naming en inglés y en plural", status: "pending" },
  { id: "naming-metric", project_id: "metric-lab", key: "naming", label: "Naming en inglés y en plural", status: "pending" },
  { id: "imports-camp", project_id: "campamento-base", key: "imports", label: "No dejar imports rotos", status: "ok" },
  { id: "imports-agents", project_id: "agents-dashboard", key: "imports", label: "No dejar imports rotos", status: "ok" },
  { id: "imports-metric", project_id: "metric-lab", key: "imports", label: "No dejar imports rotos", status: "pending" },
  { id: "runtime-camp", project_id: "campamento-base", key: "runtime", label: "Validar edge/SSR antes de deploy", status: "ok" },
  { id: "runtime-agents", project_id: "agents-dashboard", key: "runtime", label: "Validar edge/SSR antes de deploy", status: "pending" },
  { id: "runtime-metric", project_id: "metric-lab", key: "runtime", label: "Validar edge/SSR antes de deploy", status: "pending" },
  { id: "agents-camp", project_id: "campamento-base", key: "agents", label: "Revisar agents antes de activar", status: "ok" },
  { id: "agents-agents", project_id: "agents-dashboard", key: "agents", label: "Revisar agents antes de activar", status: "pending" },
  { id: "agents-metric", project_id: "metric-lab", key: "agents", label: "Revisar agents antes de activar", status: "pending" },
  { id: "build-camp", project_id: "campamento-base", key: "build", label: "Guardian del build", status: "ok" },
  { id: "build-agents", project_id: "agents-dashboard", key: "build", label: "Guardian del build", status: "pending" },
  { id: "build-metric", project_id: "metric-lab", key: "build", label: "Guardian del build", status: "pending" },
  { id: "memory-camp", project_id: "campamento-base", key: "memory", label: "Memoria de proyecto", status: "ok" },
  { id: "memory-agents", project_id: "agents-dashboard", key: "memory", label: "Memoria de proyecto", status: "ok" },
  { id: "memory-metric", project_id: "metric-lab", key: "memory", label: "Memoria de proyecto", status: "pending" },
];
