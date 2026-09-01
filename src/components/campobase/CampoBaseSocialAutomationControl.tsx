"use client";

import { useCallback, useEffect, useState } from "react";
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
    | { checksPassed: number; checksFailed: number; recommendedAction: string };
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

function agentStatusBadge(status: AgentControlCenterStatus): "ok" | "warn" | "neutral" {
  if (status === "conectado") return "ok";
  if (status === "investigando") return "warn";
  return "neutral";
}

function agentStatusLabel(status: AgentControlCenterStatus): string {
  if (status === "conectado") return "conectado";
  if (status === "investigando") return "investigando";
  return "sin datos";
}

function runStatusBadge(status: "success" | "error" | "skipped"): "ok" | "err" | "neutral" {
  if (status === "success") return "ok";
  if (status === "error") return "err";
  return "neutral";
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
        setMessage(`${payload.saasId} ${action === "enable" ? "enabled" : "disabled"}.`);
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

  return (
    <div className="space-y-6 p-6">
      <Card
        tone="glass"
        title="Operator Social Automation"
        subtitle="Control de automatización social por SaaS"
        right={status ? `${status.total} saas registrados` : "Control interno"}
        actions={(
          <Button
            variant="brand"
            loading={busyKey === "run_all"}
            onClick={() => void runAction("run_all")}
          >
            Run All
          </Button>
        )}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{status?.total ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Enabled</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-900">{status?.enabled ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-rose-700">Disabled</p>
            <p className="mt-2 text-3xl font-semibold text-rose-900">{status?.disabled ?? 0}</p>
          </div>
        </div>
      </Card>

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

      <Card tone="default" title="SaaS registrados" subtitle="Estado actual y configuración base">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando control...</p>
        ) : !status || status.items.length === 0 ? (
          <EmptyState
            title="Sin SaaS registrados"
            subtitle="El registro de automatización social todavía no tiene elementos disponibles."
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH className="px-4 py-3 text-left">Tenant</TH>
                  <TH className="px-4 py-3 text-left">SaaS</TH>
                  <TH className="px-4 py-3 text-left">Estado</TH>
                  <TH className="px-4 py-3 text-left">Niche</TH>
                  <TH className="px-4 py-3 text-left">Tone</TH>
                  <TH className="px-4 py-3 text-left">Freq/Week</TH>
                  <TH className="px-4 py-3 text-left">Updated</TH>
                  <TH className="px-4 py-3 text-left">Acciones</TH>
                </tr>
              </THead>
              <TBody>
                {status.items.map((item) => (
                  <tr key={`${item.tenantId}:${item.saasId}`} className="border-b border-slate-100 last:border-b-0">
                    <TD className="px-4 py-3 text-sm text-slate-700">{item.tenantId}</TD>
                    <TD className="px-4 py-3 text-sm font-semibold text-slate-900">{item.saasId}</TD>
                    <TD className="px-4 py-3">
                      <Badge variant={item.enabled ? "ok" : "err"}>
                        {item.enabled ? "enabled" : "disabled"}
                      </Badge>
                    </TD>
                    <TD className="px-4 py-3 text-sm text-slate-700">{item.niche}</TD>
                    <TD className="px-4 py-3 text-sm text-slate-700">{item.tone}</TD>
                    <TD className="px-4 py-3 text-sm text-slate-700">{item.frequencyPerWeek}</TD>
                    <TD className="px-4 py-3 text-sm text-slate-700">{formatDate(item.updatedAt)}</TD>
                    <TD className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={observabilityLoading && selectedScope?.tenantId === item.tenantId && selectedScope.saasId === item.saasId}
                          onClick={() => void loadObservability({ tenantId: item.tenantId, saasId: item.saasId })}
                        >
                          Ver salud
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busyKey === `enable:${item.tenantId}:${item.saasId}`}
                          disabled={item.enabled}
                          onClick={() => void runAction("enable", { tenantId: item.tenantId, saasId: item.saasId })}
                        >
                          Enable
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busyKey === `disable:${item.tenantId}:${item.saasId}`}
                          disabled={!item.enabled}
                          onClick={() => void runAction("disable", { tenantId: item.tenantId, saasId: item.saasId })}
                        >
                          Disable
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          loading={busyKey === `run_one:${item.tenantId}:${item.saasId}`}
                          disabled={!item.enabled}
                          onClick={() => void runAction("run_one", { tenantId: item.tenantId, saasId: item.saasId })}
                        >
                          Run
                        </Button>
                      </div>
                    </TD>
                  </tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card
        tone="default"
        title="Nivel 3 — Cerebro Socialcors"
        subtitle="Tendencias disparadas por el conector (socialcors_trend_triggers)"
        right={`${trendTriggers.length} registro(s)`}
      >
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Señal {trendTriggerHealth?.niche ?? "marketing"}</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{formatAgeHours(trendTriggerHealth?.trendSignalAgeHours ?? null)}</p>
            <div className="mt-3">
              <Badge variant={trendSignalFreshnessBadge(trendTriggerHealth?.trendSignalAgeHours ?? null)}>
                {trendTriggerHealth?.trendLastFetchedAt ? "trendSignals" : "sin datos"}
              </Badge>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Atascados en TRIGGERED</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{trendTriggerHealth?.stuckTriggeredCount ?? 0}</p>
            <div className="mt-3">
              <Badge variant={(trendTriggerHealth?.stuckTriggeredCount ?? 0) > 0 ? "err" : "ok"}>
                {(trendTriggerHealth?.stuckTriggeredCount ?? 0) > 0 ? "requiere revisión" : "ok"}
              </Badge>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">En cola delante</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{trendTriggerHealth?.nichesAheadInQueue ?? "—"}</p>
            <p className="mt-3 text-xs text-slate-500">nichos con turno anterior en TrendKeywordAgent</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Último score calculado</p>
            <p className="mt-2 text-3xl font-semibold text-slate-400">—</p>
            <p className="mt-3 text-xs text-slate-500">disponible tras el primer disparo</p>
          </div>
        </div>

        {trendTriggers.length === 0 ? (
          <EmptyState
            title="Sin tendencias disparadas todavía"
            subtitle="El conector sigue esperando que una tendencia supere el umbral de score configurado."
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH className="px-4 py-3 text-left">Tendencia (niche)</TH>
                  <TH className="px-4 py-3 text-left">Score</TH>
                  <TH className="px-4 py-3 text-left">Estado</TH>
                  <TH className="px-4 py-3 text-left">Detectado</TH>
                  <TH className="px-4 py-3 text-left">Post generado</TH>
                </tr>
              </THead>
              <TBody>
                {trendTriggers.map((trigger) => (
                  <tr key={trigger.id} className="border-b border-slate-100 last:border-b-0">
                    <TD className="px-4 py-3 text-sm font-semibold text-slate-900">{trigger.niche}</TD>
                    <TD className="px-4 py-3 text-sm text-slate-700">{trigger.score}</TD>
                    <TD className="px-4 py-3">
                      <Badge variant={trendTriggerBadge(trigger.status)}>{trigger.status}</Badge>
                    </TD>
                    <TD className="px-4 py-3 text-sm text-slate-700">{formatDate(trigger.createdAt)}</TD>
                    <TD className="px-4 py-3 text-sm text-slate-700">
                      {trigger.post ? (
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-900">{trigger.post.title}</span>
                          <span className="flex items-center gap-2 text-xs text-slate-500">
                            <Badge variant={healthBadge(trigger.post.status)}>{trigger.post.status}</Badge>
                            {trigger.post.provider}
                            {trigger.post.postedAt ? ` · publicado ${formatDate(trigger.post.postedAt)}` : ""}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Sin post asociado</span>
                      )}
                    </TD>
                  </tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {selectedScope && observability ? (
        <Card
          tone={observability.health.status === "healthy" ? "success" : "danger"}
          title="Salud operativa Socialcors"
          subtitle="Publishing, LinkedIn y acciones de recuperación"
          right={`${selectedScope.tenantId} / ${selectedScope.saasId}`}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Health</p>
              <Badge variant={healthBadge(observability.health.status)}>{observability.health.status}</Badge>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Scheduler</p>
              <Badge variant={healthBadge(observability.health.schedulerStatus)}>{observability.health.schedulerStatus}</Badge>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">LinkedIn</p>
              <Badge variant={observability.linkedin.connected ? "ok" : "warn"}>{observability.linkedin.primaryStatus ?? "not_connected"}</Badge>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Publishing 30d</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatPercent(observability.publishing.successRateLast30Days)}
                <span className="ml-1 font-normal text-slate-500">({observability.publishing.successLast30Days} ok / {observability.publishing.failedLast30Days} fallos)</span>
              </p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>Snapshot: {formatOptionalDate(observability.health.latestSnapshotAt)}</span>
            <span>Próximo programado: {formatOptionalDate(observability.scheduler.nextScheduledAt)}</span>
            <span>Último publicado: {formatOptionalDate(observability.scheduler.lastPublishedAt)}</span>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900">{observability.health.recommendation}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              loading={busyKey === `refresh_observability:${selectedScope.tenantId}:${selectedScope.saasId}`}
              onClick={() => void runOperatorAction("refresh_observability", selectedScope)}
            >
              Refrescar salud
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={busyKey === `linkedin_health_check:${selectedScope.tenantId}:${selectedScope.saasId}`}
              onClick={() => void runOperatorAction("linkedin_health_check", selectedScope)}
            >
              Check LinkedIn
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={busyKey === `recover_stale_publishing:${selectedScope.tenantId}:${selectedScope.saasId}`}
              disabled={observability.scheduler.stalePublishingPosts === 0}
              onClick={() => void runOperatorAction("recover_stale_publishing", selectedScope)}
            >
              Recuperar PUBLISHING
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={busyKey === `retry_failed_posts:${selectedScope.tenantId}:${selectedScope.saasId}`}
              disabled={observability.posts.recentFailed.length === 0}
              onClick={() => void runOperatorAction("retry_failed_posts", selectedScope)}
            >
              Reintentar fallidos
            </Button>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Eventos recientes</h3>
              {observability.recentEvents.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Sin eventos recientes.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {observability.recentEvents.slice(0, 5).map((event) => (
                    <li key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-sm font-medium text-slate-900">{event.summary}</p>
                      <p className="mt-1 text-xs text-slate-500">{event.activityType} · {formatDate(event.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Incidentes abiertos</h3>
              {observability.recentIncidents.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Sin incidentes abiertos.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {observability.recentIncidents.slice(0, 3).map((incident) => (
                    <li key={incident.id} className="rounded-xl border border-rose-100 bg-rose-50 p-3">
                      <p className="text-sm font-medium text-rose-900">{incident.summary}</p>
                      <p className="mt-1 text-xs text-rose-700">{incident.severity} · {formatDate(incident.openedAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <OperatorPostList
              title="Atascados en PUBLISHING"
              empty="No hay posts atascados."
              posts={observability.posts.stalePublishing}
            />
            <OperatorPostList
              title="Últimos fallos"
              empty="No hay fallos recientes."
              posts={observability.posts.recentFailed}
            />
            <OperatorPostList
              title="Últimos publicados"
              empty="No hay publicaciones recientes."
              posts={observability.posts.recentPublished}
            />
          </div>
        </Card>
      ) : observabilityLoading ? (
        <p className="text-sm text-slate-500">Cargando salud operativa...</p>
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
                <h3 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">{group.titleEs}</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {group.agents.map((agent) => (
                    <AgentControlCard key={agent.key} agent={agent} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AgentControlCard({ agent }: { agent: AgentControlCenterAgent }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{agent.nameEs}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">{agent.key}</p>
        </div>
        <Badge variant={agentStatusBadge(agent.status)}>{agentStatusLabel(agent.status)}</Badge>
      </div>

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
            <Badge variant={runStatusBadge(agent.lastRun.status)}>{agent.lastRun.status}</Badge>
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
