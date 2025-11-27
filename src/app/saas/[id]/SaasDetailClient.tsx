"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

const severityMap: Record<
  string,
  { label: string; badge: "info" | "warn" | "err" }
> = {
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

export default function SaasDetailClient() {
  const params = useParams<{ id: string }>();
  const saasId = params?.id;

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
      title: `${severityMap[a.severity]?.label ?? a.severity} • ${
        a.source
      }`,
      detail: a.message,
    }));
    const metricsEvents = metrics.map((m) => ({
      kind: "metric" as const,
      ts: new Date(m.captured_at).getTime(),
      title: "Métrica registrada",
      detail: `${m.token_count} tokens • ${(m.ai_cost_cents / 100).toFixed(
        2
      )} € • ROI ${m.roi.toFixed(2)}`,
    }));
    return [...alertsEvents, ...metricsEvents]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 30);
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
      const res = await fetch(
        `/api/provisioning?saas_id=${encodeURIComponent(saasId)}`,
        { cache: "no-store" }
      );
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
      const res = await fetch(
        `/api/saas-agents?saas_id=${encodeURIComponent(saasId)}`,
        { cache: "no-store" }
      );
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
      const res = await fetch(
        `/api/alerts?saas_id=${encodeURIComponent(saasId)}`,
        { cache: "no-store" }
      );
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
      const res = await fetch(
        `/api/metrics?scope=${encodeURIComponent(scope)}`,
        { cache: "no-store" }
      );
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
        <Link
          href="/saas"
          className="inline-flex text-[var(--brand)] text-sm font-semibold hover:underline"
        >
          Abrir listado de SaaS
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">
            Campamento Base • SaaS
          </p>
          <h1 className="text-3xl font-semibold">
            {saas?.name ?? "SaaS en provisión"}
          </h1>
          <p className="text-sm text-[var(--muted)]">ID: {saasId}</p>
        </div>
        <Link href="/saas">
          <Button variant="outline">Volver a la lista</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          tone="glass"
          title="Ficha operativa"
          subtitle="Resumen del estado actual"
          className="lg:col-span-2"
        >
          {loadingSaas ? (
            <div className="text-sm text-[var(--muted)]">
              Cargando datos del SaaS...
            </div>
          ) : !saas ? (
            <EmptyState
              title="No encontrado"
              subtitle="No existe un SaaS con este identificador"
            />
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Nombre público</dt>
                <dd className="text-lg font-semibold">{saas.name}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Slug</dt>
                <dd className="font-medium">{saas.slug}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">
                  Dominio o subdominio
                </dt>
                <dd className="font-medium">{domainDisplay}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Estado</dt>
                <dd>
                  <Badge
                    variant={
                      saas.status === "active"
                        ? "ok"
                        : saas.status === "failed"
                        ? "err"
                        : "info"
                    }
                  >
                    {saas.status}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Creado</dt>
                <dd>{new Date(saas.created_at).toLocaleString()}</dd>
              </div>
            </dl>
          )}
        </Card>
        <Card
          tone="glass"
          title="Actividad consolidada"
          subtitle="Últimos eventos registrados"
        >
          {activity.length === 0 ? (
            <EmptyState
              title="Sin actividad"
              subtitle="Aún no se han registrado eventos en este SaaS"
            />
          ) : (
            <ul className="space-y-3 text-sm">
              {activity.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={item.kind === "alert" ? "warn" : "info"}
                      >
                        {item.kind === "alert" ? "alerta" : "métrica"}
                      </Badge>
                      <span className="font-medium text-sm">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[var(--muted)] break-words">
                      {item.detail}
                    </p>
                  </div>
                  <span className="text-[var(--muted)] text-xs whitespace-nowrap">
                    {new Date(item.ts).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card
          tone="glass"
          title="Provisión"
          subtitle="Pasos del creador de SaaS"
        >
          <div
            className="flex flex-wrap gap-2 mb-4"
            aria-label="Formulario de provisión"
          >
            <Select
              aria-label="Paso de provisión"
              value={step}
              onChange={(e) => setStep(e.target.value)}
            >
              {provisioningSteps.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Estado del paso"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {provisioningStatus.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <TextInput
              aria-label="Detalles de provisión"
              className="flex-1"
              placeholder="Detalles o enlaces"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            <Button
              onClick={async () => {
                if (!saasId) return;
                await fetch("/api/provisioning", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    saas_id: saasId,
                    step,
                    status,
                    details: details || null,
                  }),
                });
                setDetails("");
                void loadProvisions();
              }}
            >
              Añadir paso
            </Button>
          </div>
          {loadingProv ? (
            <div className="text-sm text-[var(--muted)]">
              Cargando timeline...
            </div>
          ) : provisions.length === 0 ? (
            <EmptyState
              title="Sin registros"
              subtitle="Aún no se registraron pasos de provisión"
            />
          ) : (
            <ol className="space-y-3" aria-label="Historial de provisión">
              {provisions.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {
                        provisioningSteps.find((s) => s.value === p.step)
                          ?.label ?? p.step
                      }
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {
                        provisioningStatus.find((s) => s.value === p.status)
                          ?.label ?? p.status
                      }{" "}
                      • {p.details ?? "Sin detalles"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await fetch("/api/provisioning", {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            id: p.id,
                            status: "completed",
                          }),
                        });
                        void loadProvisions();
                      }}
                    >
                      Marcar listo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await fetch("/api/provisioning", {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            id: p.id,
                            status: "failed",
                          }),
                        });
                        void loadProvisions();
                      }}
                    >
                      Reportar fallo
                    </Button>
                    <span className="text-[var(--muted)]">
                      {new Date(p.created_at).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card
          tone="glass"
          title="Alertas del SaaS"
          subtitle="Mensajes críticos por módulo"
        >
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4"
            aria-label="Formulario de alertas"
          >
            <Select
              aria-label="Severidad"
              value={aSeverity}
              onChange={(e) => setASeverity(e.target.value)}
            >
              <option value="info">informativa</option>
              <option value="warning">aviso</option>
              <option value="error">crítica</option>
            </Select>
            <TextInput
              aria-label="Origen de la alerta"
              value={aSource}
              onChange={(e) => setASource(e.target.value)}
              placeholder="Origen (p. ej. Ingeniería)"
            />
            <TextArea
              aria-label="Mensaje de alerta"
              className="sm:col-span-2"
              value={aMessage}
              onChange={(e) => setAMessage(e.target.value)}
              placeholder="Describe la alerta"
            />
            <div className="sm:col-span-2 flex justify-end">
              <Button
                onClick={async () => {
                  if (!saasId || !aMessage) return;
                  await fetch("/api/alerts", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      severity: aSeverity,
                      source: aSource,
                      message: aMessage,
                      saas_id: saasId,
                    }),
                  });
                  setAMessage("");
                  void loadAlerts();
                }}
              >
                Registrar alerta
              </Button>
            </div>
          </div>
          {alertsLoading ? (
            <div className="text-sm text-[var(--muted)]">
              Cargando alertas...
            </div>
          ) : alerts.length === 0 ? (
            <EmptyState
              title="Sin alertas"
              subtitle="No se han creado alertas para este SaaS"
            />
          ) : (
            <ul
              className="space-y-3 text-sm"
              aria-label="Listado de alertas"
            >
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className="card p-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {alert.source} •{" "}
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge
                    variant={severityMap[alert.severity]?.badge ?? "info"}
                  >
                    {severityMap[alert.severity]?.label ?? alert.severity}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          tone="glass"
          title="Métricas específicas"
          subtitle="Registra consumos de IA ligados a este SaaS"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <TextInput
              aria-label="Scope de la métrica"
              value={mScope}
              onChange={(e) => setMScope(e.target.value)}
              placeholder="Scope"
            />
            <TextInput
              aria-label="Tokens"
              type="number"
              value={mTokens}
              onChange={(e) => setMTokens(Number(e.target.value))}
              placeholder="Tokens"
            />
            <TextInput
              aria-label="Coste en céntimos"
              type="number"
              value={mCost}
              onChange={(e) => setMCost(Number(e.target.value))}
              placeholder="Coste (cent)"
            />
            <TextInput
              aria-label="ROI"
              type="number"
              step="0.01"
              value={mRoi}
              onChange={(e) => setMRoi(Number(e.target.value))}
              placeholder="ROI"
            />
            <div className="md:col-span-4 flex justify-end">
              <Button
                onClick={async () => {
                  if (!mScope) return;
                  await fetch("/api/metrics", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      scope: mScope,
                      token_count: mTokens,
                      ai_cost_cents: mCost,
                      roi: mRoi,
                    }),
                  });
                  setMTokens(0);
                  setMCost(0);
                  setMRoi(0);
                  void loadMetrics();
                }}
              >
                Guardar métrica
              </Button>
            </div>
          </div>
          {metricsLoading ? (
            <div className="text-sm text-[var(--muted)]">
              Cargando métricas...
            </div>
          ) : metrics.length === 0 ? (
            <EmptyState
              title="Sin métricas"
              subtitle="Registra la primera métrica para ver evolución"
            />
          ) : (
            <div className="overflow-x-auto">
              <table
                className="modern text-sm"
                aria-label="Tabla de métricas del SaaS"
              >
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Scope</th>
                    <th>Tokens</th>
                    <th>Coste (€)</th>
                    <th>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((metric) => (
                    <tr key={metric.id}>
                      <td>
                        {new Date(metric.captured_at).toLocaleString()}
                      </td>
                      <td>{metric.scope}</td>
                      <td>{metric.token_count}</td>
                      <td>{(metric.ai_cost_cents / 100).toFixed(2)}</td>
                      <td>{metric.roi.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          tone="glass"
          title="Agentes asignados"
          subtitle="Equipo base automático por departamento"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            <Select
              aria-label="Filtrar agentes por departamento"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
            >
              <option value="">Todos los departamentos</option>
              {Array.from(new Set(saasAgents.map((agent) => agent.dept_id))).map(
                (deptId) => {
                  const item = saasAgents.find(
                    (agent) => agent.dept_id === deptId
                  );
                  if (!item) return null;
                  return (
                    <option key={deptId} value={deptId}>
                      {item.dept_nombre}
                    </option>
                  );
                }
              )}
            </Select>
          </div>
          {agentsLoading ? (
            <div className="text-sm text-[var(--muted)]">
              Cargando agentes...
            </div>
          ) : saasAgents.length === 0 ? (
            <EmptyState
              title="Sin agentes"
              subtitle="Ningún agente base fue asignado al SaaS"
            />
          ) : (
            <div className="space-y-4" aria-label="Agentes por departamento">
              {Object.values(
                saasAgents.reduce<
                  Record<string, { dept: SaasAgent; agents: SaasAgent[] }>
                >((acc, agent) => {
                  if (filterDept && agent.dept_id !== filterDept) return acc;
                  if (!acc[agent.dept_id])
                    acc[agent.dept_id] = { dept: agent, agents: [] };
                  acc[agent.dept_id].agents.push(agent);
                  return acc;
                }, {})
              ).map(({ dept, agents }) => (
                <section key={dept.dept_id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold">
                        {dept.dept_nombre}
                      </h3>
                      <p className="text-xs text-[var(--muted)]">
                        {dept.dept_descripcion ??
                          "Departamento base del Campamento."}
                      </p>
                    </div>
                    <Badge
                      variant={dept.dept_es_critico ? "err" : "info"}
                    >
                      {dept.dept_es_critico ? "crítico" : "operativo"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {agents.map((agent) => (
                      <article
                        key={agent.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/70 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">
                              {agent.agent_nombre}
                            </p>
                            <p className="text-xs text-[var(--muted)] capitalize">
                              Tipo: {agent.agent_tipo}
                            </p>
                          </div>
                          <Badge
                            variant={
                              agent.estado === "activo"
                                ? "ok"
                                : agent.estado === "pausado"
                                ? "warn"
                                : "info"
                            }
                          >
                            {agent.estado}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-[var(--foreground)]">
                          {agent.agent_descripcion ??
                            "Agente listo para ejecutar tareas del departamento."}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                          <span>ID asignación: {agent.id}</span>
                          <span>Slug: {agent.agent_slug}</span>
                          <span>
                            Registrado:{" "}
                            {new Date(
                              agent.assigned_at
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
