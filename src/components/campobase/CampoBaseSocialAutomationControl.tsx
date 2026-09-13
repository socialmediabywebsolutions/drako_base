"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import { Table, TableWrap, TBody, TD, TH, THead } from "@/components/ui/table";
import type {
  CampoBaseSocialAutomationBatchOutput,
  CampoBaseSocialAutomationOutput,
  CampoBaseSocialAutomationStatusOutput,
  CampoBaseSocialAutomationToggleOutput,
  CampoBaseSocialFlowObservability,
  CampoBaseSocialFlowOperatorAction,
  CampoBaseSocialFlowOperatorActionResult,
} from "@/lib/campamento-base/socialflow-control-plane-service";
import type { SocialFlowTrendTrigger, SocialFlowTrendTriggerHealth } from "@/lib/capabilities/internal-api-types/socialflow";
import type { AgentControlCenterAgent, AgentControlCenterGroup, AgentControlCenterStatus } from "@/lib/campamento-base/socialflow-agent-control-center";

type ControlResponse = {
  status?: CampoBaseSocialAutomationStatusOutput;
  result?:
    | CampoBaseSocialAutomationBatchOutput
    | CampoBaseSocialAutomationOutput
    | CampoBaseSocialAutomationToggleOutput
    | CampoBaseSocialFlowOperatorActionResult
    | { refreshed: boolean; tenantId: string; saasId: string }
    | { checksPassed: number; checksFailed: number; recommendedAction: string }
    | { kind: "BLOCKED_INTENT" | "AI_GENERATED"; suggestedReply: string; aiMetadata?: Record<string, unknown> };
  observability?: CampoBaseSocialFlowObservability | null;
  trendTriggers?: SocialFlowTrendTrigger[];
  trendTriggerHealth?: SocialFlowTrendTriggerHealth | null;
  agentControlCenter?: AgentControlCenterGroup[];
  message?: string;
  code?: string;
};

const endpoint = "/api/operator/socialflow";

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatOptionalDate(value: string | null): string {
  if (!value) return "Sin datos";
  return formatDate(value);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function healthBadge(status: string): "ok" | "warn" | "err" | "neutral" {
  if (status === "healthy" || status === "fresh" || status === "idle" || status === "CONNECTED_REAL") return "ok";
  if (status === "needs_attention" || status === "stale" || status === "active" || status === "PUBLISHING") return "warn";
  if (status === "degraded" || status === "FAILED") return "err";
  return "neutral";
}

// Nivel 3 — TRIGGERED: en curso, esperando la ventana de auto-aprobación (info, no un
// problema). AUTO_APPROVED: éxito. GENERATION_FAILED: fallo real. VETOED: ver el
// comentario en el tipo SocialFlowTrendTriggerStatus — no lo escribe ningún código
// todavía, pero el badge está listo para cuando se cierre ese gap.
function trendTriggerBadge(status: string): "ok" | "warn" | "err" | "info" | "neutral" {
  if (status === "AUTO_APPROVED") return "ok";
  if (status === "GENERATION_FAILED") return "err";
  if (status === "TRIGGERED") return "info";
  if (status === "VETOED") return "neutral";
  return "neutral";
}

// Mismos tramos que freshnessMultiplier() en TrendTriggerConnector.ts, colapsados a 3
// para el semáforo: ≤6h (todavía dentro del rango donde el score cuenta casi completo)
// ok, ≤24h warn, >24h err (el conector ya trataría esto como señal descartada).
function trendSignalFreshnessBadge(ageHours: number | null): "ok" | "warn" | "err" | "neutral" {
  if (ageHours === null) return "neutral";
  if (ageHours <= 6) return "ok";
  if (ageHours <= 24) return "warn";
  return "err";
}

function formatAgeHours(hours: number | null): string {
  if (hours === null) return "Sin datos";
  if (hours < 1) return "hace <1h";
  if (hours < 48) return `hace ${Math.round(hours)}h`;
  return `hace ${Math.round(hours / 24)}d`;
}

function agentStatusBadge(agent: AgentControlCenterAgent): "ok" | "warn" | "err" | "neutral" {
  if (agent.lastRun?.status === "error") return "err";
  if (agent.status === "conectado") return "ok";
  if (agent.status === "investigando") return "warn";
  return "neutral";
}

function agentStatusLabel(agent: AgentControlCenterAgent): string {
  if (agent.lastRun?.status === "error") return "error";
  if (agent.status === "conectado") return "conectado";
  if (agent.status === "investigando") return "investigando";
  return "Esperando datos";
}

function runStatusBadge(status: "success" | "error" | "skipped"): "ok" | "err" | "neutral" {
  if (status === "success") return "ok";
  if (status === "error") return "err";
  return "neutral";
}

function runStatusLabel(status: "success" | "error" | "skipped"): string {
  if (status === "success") return "Exitoso";
  if (status === "error") return "Error";
  return "Omitido";
}

const POST_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHING: "Publicación",
  PUBLISHED: "Publicado",
  FAILED: "Fallido",
};

function postStatusLabel(status: string): string {
  return POST_STATUS_LABELS[status] ?? status;
}

function countActiveAgents(agents: AgentControlCenterAgent[]): number {
  return agents.filter((agent) => {
    const variant = agentStatusBadge(agent);
    return variant === "ok" || variant === "warn";
  }).length;
}

export default function CampoBaseSocialAutomationControl() {
  const [status, setStatus] = useState<CampoBaseSocialAutomationStatusOutput | null>(null);
  const [selectedScope, setSelectedScope] = useState<{ tenantId: string; saasId: string } | null>(null);
  const [observability, setObservability] = useState<CampoBaseSocialFlowObservability | null>(null);
  const [observabilityLoading, setObservabilityLoading] = useState(false);
  const [trendTriggers, setTrendTriggers] = useState<SocialFlowTrendTrigger[]>([]);
  const [trendTriggerHealth, setTrendTriggerHealth] = useState<SocialFlowTrendTriggerHealth | null>(null);
  const [agentControlCenter, setAgentControlCenter] = useState<AgentControlCenterGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [openAgentKey, setOpenAgentKey] = useState<string | null>(null);

  // Probador de respuestas IA — movido aquí desde el CRM Social del cliente (era una
  // herramienta de diagnóstico interna, no algo que el cliente final deba ver, ver
  // acción "test_ai_reply" en api/operator/socialflow/route.ts).
  const [testTenantKey, setTestTenantKey] = useState("");
  const [testNiche, setTestNiche] = useState("");
  const [testChannel, setTestChannel] = useState("INSTAGRAM");
  const [testThreadType, setTestThreadType] = useState<"DM" | "COMMENT">("DM");
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<{ kind: "BLOCKED_INTENT" | "AI_GENERATED"; suggestedReply: string } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);

  const loadObservability = useCallback(async (scope: { tenantId: string; saasId: string }) => {
    setSelectedScope(scope);
    setObservabilityLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        tenantId: scope.tenantId,
        saasId: scope.saasId,
      });
      const response = await fetch(`${endpoint}?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as ControlResponse | null;

      if (!response.ok) {
        throw new Error(data?.message ?? "No se pudo cargar la salud de Socialcors.");
      }

      if (data?.status) {
        setStatus(data.status);
      }
      setObservability(data?.observability ?? null);
    } catch (loadError) {
      setObservability(null);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la salud de Socialcors.");
    } finally {
      setObservabilityLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as ControlResponse | null;

      if (!response.ok || !data?.status) {
        throw new Error(data?.message ?? "No se pudo cargar el control de Socialcors.");
      }

      setStatus(data.status);
      setTrendTriggers(data.trendTriggers ?? []);
      setTrendTriggerHealth(data.trendTriggerHealth ?? null);
      setAgentControlCenter(data.agentControlCenter ?? []);
      const firstItem = data.status.items[0];
      if (firstItem) {
        void loadObservability({ tenantId: firstItem.tenantId, saasId: firstItem.saasId });
      } else {
        setSelectedScope(null);
        setObservability(null);
      }
    } catch (loadError) {
      setStatus(null);
      setSelectedScope(null);
      setObservability(null);
      setTrendTriggers([]);
      setTrendTriggerHealth(null);
      setAgentControlCenter([]);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el control de Socialcors.");
    } finally {
      setLoading(false);
    }
  }, [loadObservability]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function runAction(
    action: "run_all" | "run_one" | "enable" | "disable",
    payload?: { tenantId: string; saasId: string },
  ) {
    const key = payload ? `${action}:${payload.tenantId}:${payload.saasId}` : action;
    setBusyKey(key);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = (await response.json().catch(() => null)) as ControlResponse | null;

      if (!response.ok || !data?.status) {
        throw new Error(data?.message ?? "No se pudo completar la acción.");
      }

      setStatus(data.status);

      if (action === "run_all" && data.result && "success" in data.result) {
        setMessage(`Run All ejecutado: ${data.result.success}/${data.result.total} ok.`);
        return;
      }

      if (action === "run_one" && payload) {
        setMessage(`Automatización lanzada para ${payload.saasId}.`);
        return;
      }

      if ((action === "enable" || action === "disable") && payload) {
        setMessage(`${payload.saasId} ${action === "enable" ? "activado" : "desactivado"}.`);
      }

      if (payload && selectedScope?.tenantId === payload.tenantId && selectedScope.saasId === payload.saasId) {
        void loadObservability(payload);
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo completar la acción.");
    } finally {
      setBusyKey(null);
    }
  }

  async function runOperatorAction(
    action: CampoBaseSocialFlowOperatorAction | "refresh_observability" | "linkedin_health_check",
    payload: { tenantId: string; saasId: string },
  ) {
    const key = `${action}:${payload.tenantId}:${payload.saasId}`;
    setBusyKey(key);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = (await response.json().catch(() => null)) as ControlResponse | null;

      if (!response.ok || !data?.status) {
        throw new Error(data?.message ?? "No se pudo completar la acción segura.");
      }

      setStatus(data.status);
      setObservability(data.observability ?? null);

      if (action === "refresh_observability") {
        setMessage(`Observabilidad actualizada para ${payload.saasId}.`);
      } else if (action === "linkedin_health_check" && data.result && "checksPassed" in data.result) {
        setMessage(`LinkedIn health check: ${data.result.checksPassed} checks ok, ${data.result.checksFailed} fallos.`);
      } else if (data.result && "message" in data.result) {
        setMessage(data.result.message);
      } else {
        setMessage(`Acción segura ejecutada para ${payload.saasId}.`);
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo completar la acción segura.");
    } finally {
      setBusyKey(null);
    }
  }

  // status.items trae una fila por automationKey registrada — varios tenants
  // registran más de una (content_generation + health_check), así que se deduplica
  // por tenant/saasId para el selector.
  const testTenantOptions = useMemo(() => {
    const seen = new Map<string, { key: string; tenantId: string; saasId: string; niche: string | null; displayName: string }>();
    for (const item of status?.items ?? []) {
      const key = `${item.tenantId}:${item.saasId}`;
      if (!seen.has(key)) {
        seen.set(key, { key, tenantId: item.tenantId, saasId: item.saasId, niche: item.niche, displayName: item.displayName });
      }
    }
    return Array.from(seen.values());
  }, [status]);

  function handleTestTenantChange(key: string) {
    setTestTenantKey(key);
    const found = testTenantOptions.find((t) => t.key === key);
    setTestNiche(found?.niche ?? "");
  }

  async function runAiReplyTest() {
    const selected = testTenantOptions.find((t) => t.key === testTenantKey);
    if (!selected || !testMessage.trim()) return;

    setTestBusy(true);
    setTestError(null);
    setTestResult(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_ai_reply",
          tenantId: selected.tenantId,
          saasId: selected.saasId,
          niche: testNiche,
          provider: testChannel,
          threadType: testThreadType,
          message: testMessage,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { result?: { kind: "BLOCKED_INTENT" | "AI_GENERATED"; suggestedReply: string }; message?: string }
        | null;

      if (!response.ok || !data?.result) {
        throw new Error(data?.message ?? "No se pudo generar la respuesta de prueba.");
      }

      setTestResult(data.result);
    } catch (testErr) {
      setTestError(testErr instanceof Error ? testErr.message : "No se pudo generar la respuesta de prueba.");
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <Card
        tone="default"
        title="Centro de control de agentes"
        subtitle="Los 26 agentes del Cerebro Socialcors — estado, última ejecución y contenido real, leídos directo de SOCIAL_DB"
      >
        {agentControlCenter.length === 0 ? (
          <EmptyState
            title="Sin datos del centro de control"
            subtitle="Todavía no se pudo leer el estado de los agentes desde SOCIAL_DB."
          />
        ) : (
          <div className="space-y-8">
            {agentControlCenter.map((group) => (
              <div key={group.key}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{group.titleEs}</h3>
                  <span className="text-xs font-semibold text-slate-500">
                    {countActiveAgents(group.agents)} de {group.agents.length} activos
                  </span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {group.agents.map((agent) => (
                    <AgentControlAccordionItem
                      key={agent.key}
                      agent={agent}
                      isOpen={openAgentKey === agent.key}
                      onToggle={() =>
                        setOpenAgentKey((prev) => (prev === agent.key ? null : agent.key))
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        tone="default"
        title="Probador de respuestas IA"
        subtitle="Herramienta de diagnóstico interna — simula un mensaje entrante y ve exactamente qué respondería la IA para un tenant real"
      >
        {testTenantOptions.length === 0 ? (
          <EmptyState
            title="Sin tenants activos"
            subtitle="No hay tenants registrados en la automatización de Socialcors todavía."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs font-semibold text-slate-500">
                Tenant
                <select
                  value={testTenantKey}
                  onChange={(e) => handleTestTenantChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
                >
                  <option value="">Selecciona un tenant…</option>
                  {testTenantOptions.map((t) => (
                    <option key={t.key} value={t.key}>{t.displayName} ({t.saasId})</option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-500">
                Nicho
                <input
                  type="text"
                  value={testNiche}
                  onChange={(e) => setTestNiche(e.target.value)}
                  placeholder="Se rellena al elegir tenant — editable"
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-500">
                Canal
                <select
                  value={testChannel}
                  onChange={(e) => setTestChannel(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
                >
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="FACEBOOK_PAGE">Facebook</option>
                  <option value="LINKEDIN">LinkedIn</option>
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-500">
                Tipo
                <select
                  value={testThreadType}
                  onChange={(e) => setTestThreadType(e.target.value as "DM" | "COMMENT")}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
                >
                  <option value="DM">DM</option>
                  <option value="COMMENT">Comentario</option>
                </select>
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-500">
              Mensaje de prueba
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Pega aquí un mensaje entrante…"
                rows={3}
                className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
              />
            </label>

            <Button
              variant="primary"
              size="md"
              loading={testBusy}
              disabled={testBusy || !testTenantKey || !testMessage.trim()}
              onClick={runAiReplyTest}
            >
              Generar respuesta
            </Button>

            {testError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {testError}
              </div>
            ) : null}

            {testResult ? (
              <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
                <Badge variant={testResult.kind === "BLOCKED_INTENT" ? "warn" : "ok"}>
                  {testResult.kind} · {testResult.kind === "BLOCKED_INTENT" ? "derivación al humano" : "respuesta de la IA"}
                </Badge>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{testResult.suggestedReply}</p>
              </div>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}

function AgentControlAccordionItem({
  agent,
  isOpen,
  onToggle,
}: {
  agent: AgentControlCenterAgent;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className={`text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
          <span className="truncate text-sm font-semibold text-slate-900">{agent.nameEs}</span>
        </span>
        <span className="flex items-center gap-3 text-xs text-slate-500">
          <Badge variant={agentStatusBadge(agent)}>{agentStatusLabel(agent)}</Badge>
          <span>
            {agent.lastRun ? formatDate(agent.lastRun.startedAt) : "Sin ejecuciones registradas"}
          </span>
        </span>
      </button>

      {isOpen ? (
        <div className="border-t border-slate-100 p-4 pt-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">{agent.key}</p>

          <p className="mt-3 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Flujo: </span>
            {agent.flow}
          </p>

          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Contenido real</p>
            <p className="mt-1 text-sm text-slate-800">{agent.contentSummary}</p>
            {agent.contentAt ? (
              <p className="mt-1 text-xs text-slate-500">
                {formatDate(agent.contentAt)}
                {agent.contentTenantId ? ` · tenant ${agent.contentTenantId}` : ""}
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500">Última ejecución (agent_execution_log)</span>
            {agent.lastRun ? (
              <span className="flex items-center gap-2">
                <Badge variant={runStatusBadge(agent.lastRun.status)}>{runStatusLabel(agent.lastRun.status)}</Badge>
                <span className="text-slate-500">
                  {formatDate(agent.lastRun.startedAt)}
                  {agent.lastRun.rowsWritten !== null ? ` · ${agent.lastRun.rowsWritten} fila(s)` : ""}
                </span>
              </span>
            ) : (
              <span className="text-slate-400">Sin ejecuciones registradas</span>
            )}
          </div>
          {agent.lastRun?.errorMessage ? (
            <p className="mt-2 text-xs text-rose-700">{agent.lastRun.errorMessage}</p>
          ) : null}
          {agent.note ? <p className="mt-2 text-xs text-slate-400">{agent.note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function OperatorPostList({
  title,
  empty,
  posts,
}: {
  title: string;
  empty: string;
  posts: CampoBaseSocialFlowObservability["posts"]["recentPublished"];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {posts.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {posts.map((post) => (
            <li key={post.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{post.title}</p>
                <Badge variant={healthBadge(post.status)}>{post.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {post.provider} · actualizado {formatDate(post.updatedAt)}
              </p>
              {post.lastErrorMessage ? (
                <p className="mt-2 text-xs text-rose-700">{post.lastErrorMessage}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
