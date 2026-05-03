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
} from "@/lib/campobase/socialflow-service";

type ControlResponse = {
  status?: CampoBaseSocialAutomationStatusOutput;
  result?: CampoBaseSocialAutomationBatchOutput | CampoBaseSocialAutomationOutput | CampoBaseSocialAutomationToggleOutput;
  observability?: CampoBaseSocialFlowObservability | null;
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

export default function CampoBaseSocialAutomationControl() {
  const [status, setStatus] = useState<CampoBaseSocialAutomationStatusOutput | null>(null);
  const [selectedScope, setSelectedScope] = useState<{ tenantId: string; saasId: string } | null>(null);
  const [observability, setObservability] = useState<CampoBaseSocialFlowObservability | null>(null);
  const [observabilityLoading, setObservabilityLoading] = useState(false);
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
        throw new Error(data?.message ?? "No se pudo cargar la salud de SocialFlow.");
      }

      if (data?.status) {
        setStatus(data.status);
      }
      setObservability(data?.observability ?? null);
    } catch (loadError) {
      setObservability(null);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la salud de SocialFlow.");
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
        throw new Error(data?.message ?? "No se pudo cargar el control de SocialFlow.");
      }

      setStatus(data.status);
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
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el control de SocialFlow.");
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
        tone={observability?.health.status === "healthy" ? "success" : observability ? "danger" : "default"}
        title="Salud operativa SocialFlow"
        subtitle="Contrato operator de observabilidad"
        right={selectedScope ? `${selectedScope.tenantId} / ${selectedScope.saasId}` : "Sin SaaS seleccionado"}
      >
        {observabilityLoading ? (
          <p className="text-sm text-slate-500">Cargando salud operativa...</p>
        ) : !selectedScope ? (
          <EmptyState
            title="Selecciona un SaaS"
            subtitle="La salud operativa se consulta por tenant y SaaS desde el contrato público de SocialFlow."
          />
        ) : !observability ? (
          <EmptyState
            title="Sin observabilidad disponible"
            subtitle="El contrato todavía no ha devuelto métricas para este workspace."
          />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Health</p>
                <div className="mt-3">
                  <Badge variant={healthBadge(observability.health.status)}>
                    {observability.health.status}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Snapshot: {formatOptionalDate(observability.health.latestSnapshotAt)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Scheduler</p>
                <div className="mt-3">
                  <Badge variant={healthBadge(observability.health.schedulerStatus)}>
                    {observability.health.schedulerStatus}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Due: {observability.scheduler.dueScheduledPosts} / Publishing: {observability.scheduler.publishingPosts}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">LinkedIn</p>
                <div className="mt-3">
                  <Badge variant={observability.linkedin.connected ? "ok" : "warn"}>
                    {observability.linkedin.primaryStatus ?? "not_connected"}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {observability.linkedin.totalConnections} conexión(es)
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Publishing 30d</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {formatPercent(observability.publishing.successRateLast30Days)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {observability.publishing.successLast30Days} ok / {observability.publishing.failedLast30Days} fallos
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Recomendación</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{observability.health.recommendation}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Publishing queue</h3>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Scheduled</p>
                    <p className="font-semibold text-slate-900">{observability.scheduler.scheduledPosts}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Stale PUBLISHING</p>
                    <p className="font-semibold text-slate-900">{observability.scheduler.stalePublishingPosts}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Next scheduled</p>
                    <p className="font-semibold text-slate-900">{formatOptionalDate(observability.scheduler.nextScheduledAt)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Last published</p>
                    <p className="font-semibold text-slate-900">{formatOptionalDate(observability.scheduler.lastPublishedAt)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Métricas</h3>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">7 días publicados</p>
                    <p className="font-semibold text-slate-900">{observability.metrics.last7Days.publishedPosts}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">30 días publicados</p>
                    <p className="font-semibold text-slate-900">{observability.metrics.last30Days.publishedPosts}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Engagement 7d</p>
                    <p className="font-semibold text-slate-900">{observability.metrics.last7Days.engagement}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Top provider</p>
                    <p className="font-semibold text-slate-900">{observability.metrics.last30Days.topProvider ?? "Sin datos"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
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

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Eventos recientes</h3>
                {observability.recentEvents.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Sin eventos recientes.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {observability.recentEvents.slice(0, 5).map((event) => (
                      <li key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <p className="text-sm font-medium text-slate-900">{event.summary}</p>
                        <p className="mt-1 text-xs text-slate-500">{event.activityType} · {formatDate(event.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Incidentes abiertos</h3>
                {observability.recentIncidents.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Sin incidentes abiertos.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {observability.recentIncidents.slice(0, 5).map((incident) => (
                      <li key={incident.id} className="rounded-xl border border-rose-100 bg-rose-50 p-3">
                        <p className="text-sm font-medium text-rose-900">{incident.summary}</p>
                        <p className="mt-1 text-xs text-rose-700">{incident.severity} · {formatDate(incident.openedAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
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
