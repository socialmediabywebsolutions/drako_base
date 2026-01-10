import type {
  DevArchitectChecklist,
  DevArchitectMode,
  DevArchitectProject,
  DevArchitectProjectMetrics,
  DevArchitectSession,
  DevArchitectTask,
} from "@/lib/dev-architects/types";
export type { DevArchitectMode } from "@/lib/dev-architects/types";

const STORAGE_KEY = "orchestrator:context";

export type BillingSummary = {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  amount_cents: number;
};

export type SupportSummary = {
  total: number;
  open: number;
  resolved: number;
  high_priority: number;
};

export type SaasContext = {
  scope: "saas";
  saas: {
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
    billing?: BillingSummary;
    support?: SupportSummary;
  };
  detalle?: {
    provisiones?: {
      id: string;
      paso: string;
      estado: string;
      creado: string;
      detalles?: string | null;
    }[];
    alertas?: {
      id: string;
      severidad: string;
      fuente: string;
      mensaje: string;
      creado: string;
    }[];
    agentes?: {
      id: string;
      nombre: string;
      departamento: string;
      departamento_id?: string;
      estado: string;
    }[];
  };
};

export type InboxContext = {
  scope: "inbox";
  inbox: {
    id: string;
    channel: string;
    status: string;
    department_id: string | null;
    department_label?: string | null;
    subject: string | null;
    preview: string;
    saas_id: string | null;
    saas_name?: string | null;
    company_id?: string | null;
    company_name?: string | null;
  };
};

export type ClientContext = {
  scope: "client";
  client: {
    id: string;
    name: string;
    nif: string | null;
    email: string | null;
    phone: string | null;
  };
  billing?: BillingSummary;
  support?: SupportSummary;
  detalle?: {
    saas?: { id: string; name: string; slug: string; status: string }[];
  };
};

export type DevArchitectContext = {
  scope: "devarchitect";
  agentId?: string;
  devArchitect: {
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
    activeProjectId: string;
    mode: DevArchitectMode;
  };
};

export type OrchestratorContextPayload = SaasContext | InboxContext | ClientContext | DevArchitectContext | null;

export function getOrchestratorContext(): OrchestratorContextPayload {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OrchestratorContextPayload;
  } catch {
    return null;
  }
}

export function setOrchestratorContext(payload: OrchestratorContextPayload) {
  if (typeof window === "undefined") return;
  if (payload) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } else {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new CustomEvent(STORAGE_KEY, { detail: payload }));
}

export function subscribeOrchestratorContext(cb: (payload: OrchestratorContextPayload) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<OrchestratorContextPayload>).detail ?? null;
    cb(detail);
  };
  window.addEventListener(STORAGE_KEY, handler as EventListener, false);
  return () => window.removeEventListener(STORAGE_KEY, handler as EventListener, false);
}
