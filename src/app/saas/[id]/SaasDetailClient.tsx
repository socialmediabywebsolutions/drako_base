// src/app/saas/[id]/SaasDetailClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import Select from "@/components/ui/select";
import { TextInput, TextArea } from "@/components/ui/input";
import EmptyState from "@/components/ui/empty-state";
import { setOrchestratorContext } from "@/lib/orchestrator-context";

type Saas = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  subdomain: string | null;
  status: string;
  created_at: string;
};

type Provision = {
  id: string;
  saas_id: string;
  step: string;
  status: string;
  details: string | null;
  created_at: string;
};

type Alert = {
  id: string;
  severity: string;
  source: string;
  message: string;
  created_at: string;
};

type Metric = {
  id: number;
  scope: string;
  token_count: number;
  ai_cost_cents: number;
  roi: number;
  captured_at: string;
};

type SaasAgent = {
  id: string;
  core_agent_id: string;
  estado: string;
  config: string;
  assigned_at: string;
  agent_nombre: string;
  agent_descripcion: string | null;
  agent_tipo: string;
  agent_slug: string;
  dept_id: string;
  dept_slug: string;
  dept_nombre: string;
  dept_descripcion: string | null;
  dept_es_critico: number;
};

type SaasDetailClientProps = {
  saasId: string | null;
};

const severityMap: Record<string, { label: string; badge: "info" | "warn" | "err" }> = {
  info: { label: "informativa", badge: "info" },
  warning: { label: "aviso", badge: "warn" },
  error: { label: "crítica", badge: "err" },
};

const provisioningSteps = [
  { value: "pages_project", label: "Proyecto en Pages" },
  { value: "domain", label: "Dominio" },
  { value: "connect", label: "Integraciones" },
  { value: "done", label: "Operativo" },
  { value: "failed", label: "Incidencia" },
];

const provisioningStatus = [
  { value: "pending", label: "Pendiente" },
  { value: "running", label: "En curso" },
  { value: "completed", label: "Completado" },
  { value: "failed", label: "Fallido" },
];

export default function SaasDetailClient({ saasId }: SaasDetailClientProps) {
  const [saas, setSaas] = useState<Saas | null>(null);
  const [loadingSaas, setLoadingSaas] = useState(true);

  const [provisions, setProvisions] = useState<Provision[]>([]);
  const [loadingProv, setLoadingProv] = useState(true);
  const [step, setStep] = useState("pages_project");
  const [status, setStatus] = useState("pending");
  const [details, setDetails] = useState("");

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [aSeverity, setASeverity] = useState("info");
  const [aSource, setASource] = useState("Orquestador DRĀKO");
  const [aMessage, setAMessage] = useState("");

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [mScope, setMScope] = useState<string>("");
  const [mTokens, setMTokens] = useState<number>(0);
  const [mCost, setMCost] = useState<number>(0);
  const [mRoi, setMRoi] = useState<number>(0);

  const [filterDept, setFilterDept] = useState<string>("");
  const [saasAgents, setSaasAgents] = useState<SaasAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);

  const contextDetalle = useMemo(() => {
    return {
      provisiones: provisions.slice(0, 10).map((item) => ({
        id: item.id,
        paso: item.step,
        estado: item.status,
        creado: item.created_at,
        detalles: item.details ?? null,
      })),
      alertas: alerts.slice(0, 10).map((alert) => ({
        id: alert.id,
        severidad: alert.severity,
        fuente: alert.source,
        mensaje: alert.message,
        creado: alert.created_at,
      })),
      agentes: saasAgents.map((agent) => ({
        id: agent.id,
        nombre: agent.agent_nombre,
        departamento: agent.dept_nombre,
        departamento_id: agent.dept_id,
        estado: agent.estado,
      })),
    };
  }, [alerts, provisions, saasAgents]);

  const domainDisplay = useMemo(() => {
    if (!saas) return "-";
    return saas.domain ?? saas.subdomain ?? "-";
  }, [saas]);

  const activity = useMemo(() => {
    const alertsEvents = alerts.map((a) => ({
      kind: "alert" as const,
      ts: new Date(a.created_at).getTime(),
      title: `${severityMap[a.severity]?.label ?? a.severity} • ${a.source}`,
      detail: a.message,
    }));
    const metricsEvents = metrics.map((m) => ({
      kind: "metric" as const,
      ts: new Date(m.captured_at).getTime(),
      title: "Métrica registrada",
      detail: `${m.token_count} tokens • ${(m.ai_cost_cents / 100).toFixed(2)} € • ROI ${m.roi.toFixed(2)}`,
    }));
    return [...alertsEvents, ...metricsEvents].sort((a, b) => b.ts - a.ts).slice(0, 30);
  }, [alerts, metrics]);

  const loadSaas = useCallback(async () => {
    if (!saasId) return;
    setLoadingSaas(true);
    try {
      const res = await fetch("/api/saas", { cache: "no-store" });
      const data = (await res.json()) as { items?: Saas[] };
      const found = (data.items ?? []).find((item) => item.id === saasId);
      setSaas(found ?? null);
    } finally {
      setLoadingSaas(false);
    }
  }, [saasId]);

  const loadProvisions = useCallback(async () => {
    if (!saasId) return;
    setLoadingProv(true);
    try {
      const res = await fetch(`/api/provisioning?saas_id=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: Provision[] };
      setProvisions(data.items ?? []);
    } finally {
      setLoadingProv(false);
    }
  }, [saasId]);

  const loadSaasAgents = useCallback(async () => {
    if (!saasId) return;
    setAgentsLoading(true);
    try {
      const res = await fetch(`/api/saas-agents?saas_id=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: SaasAgent[] };
      setSaasAgents(data.items ?? []);
    } finally {
      setAgentsLoading(false);
    }
  }, [saasId]);

  const loadAlerts = useCallback(async () => {
    if (!saasId) return;
    setAlertsLoading(true);
    try {
      const res = await fetch(`/api/alerts?saas_id=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: Alert[] };
      setAlerts(data.items ?? []);
    } finally {
      setAlertsLoading(false);
    }
  }, [saasId]);

  const loadMetrics = useCallback(async () => {
    if (!saasId) return;
    setMetricsLoading(true);
    try {
      const scope = `saas:${saasId}`;
      const res = await fetch(`/api/metrics?scope=${encodeURIComponent(scope)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: Metric[] };
      setMetrics(data.items ?? []);
      setMScope(scope);
    } finally {
      setMetricsLoading(false);
    }
  }, [saasId]);

  useEffect(() => {
    void loadSaas();
  }, [loadSaas]);
  useEffect(() => {
    void loadProvisions();
  }, [loadProvisions]);
  useEffect(() => {
    void loadSaasAgents();
  }, [loadSaasAgents]);
  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);
  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    if (!saas) return;
    setOrchestratorContext({
      scope: "saas",
      saas: {
        id: saas.id,
        name: saas.name,
        slug: saas.slug,
        domain: saas.domain ?? saas.subdomain ?? null,
        status: saas.status,
      },
      detalle: contextDetalle,
    });
    return () => setOrchestratorContext(null);
  }, [contextDetalle, saas]);

  if (!saasId) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Selecciona un SaaS"
          subtitle="Necesitas abrir un SaaS específico para ver su ficha."
        />
        <Link href="/saas" className="inline-flex text-[var(--brand)] text-sm font-semibold hover:underline">
          Abrir listado de SaaS
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* TODO: aquí va TODO el mismo JSX que ya tenías
          (desde el primer <div className="flex flex-wrap ..."> hasta el final).
          Puedes reutilizar EXACTAMENTE lo que pegaste, solo he movido
          la parte de useParams al wrapper de page.tsx */}
      {/* Para que no sea eterno aquí, copia desde
          ` <div className="flex flex-wrap items-center...">`
          hasta el final, igual que estaba. */}
    </div>
  );
}
