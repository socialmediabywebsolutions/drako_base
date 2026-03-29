"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import { Table, TableWrap, TBody, TD, TH, THead } from "@/components/ui/table";
import type { PlatformOperatorSurface } from "@/lib/campobase/platform-operator-service";

const endpoint = "/api/operator/platform";

type SurfaceResponse = {
  surface?: PlatformOperatorSurface;
  result?: unknown;
  action?: string;
  message?: string;
  code?: string;
};

function formatDate(value: string | null): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function badgeForStatus(status: string) {
  if (status === "healthy" || status === "fresh" || status === "CONNECTED" || status === "SUCCESS" || status === "success") {
    return "ok" as const;
  }
  if (
    status === "needs_attention"
    || status === "stale"
    || status === "NEEDS_REAUTH"
    || status === "warning"
    || status === "medium"
  ) {
    return "warn" as const;
  }
  if (
    status === "degraded"
    || status === "INVALID"
    || status === "DISCONNECTED"
    || status === "FAILED"
    || status === "error"
    || status === "high"
    || status === "critical"
  ) {
    return "err" as const;
  }
  return "neutral" as const;
}

export default function PlatformOperatorControlSurface(props: {
  initialTenantId?: string;
  initialSaasId?: string;
}) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState(props.initialTenantId ?? "");
  const [saasId, setSaasId] = useState(props.initialSaasId ?? "");
  const [surface, setSurface] = useState<PlatformOperatorSurface | null>(null);
  const [loading, setLoading] = useState(Boolean(props.initialTenantId && props.initialSaasId));
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canLoad = useMemo(() => Boolean(tenantId.trim() && saasId.trim()), [tenantId, saasId]);

  async function loadSurface(nextTenantId = tenantId, nextSaasId = saasId) {
    if (!nextTenantId.trim() || !nextSaasId.trim()) {
      setSurface(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({ tenantId: nextTenantId.trim(), saasId: nextSaasId.trim() });
      const response = await fetch(`${endpoint}?${query.toString()}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as SurfaceResponse | null;

      if (!response.ok || !data?.surface) {
        throw new Error(data?.message ?? "Could not load platform operator surface.");
      }

      setSurface(data.surface);
    } catch (loadError) {
      setSurface(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load platform operator surface.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (props.initialTenantId && props.initialSaasId) {
      void loadSurface(props.initialTenantId, props.initialSaasId);
    } else {
      setLoading(false);
    }
  }, [props.initialTenantId, props.initialSaasId]);

  async function runAction(
    action: "refresh" | "run_automation" | "enable_automation" | "disable_automation" | "validate_integration",
    payload?: { automationKey?: string; integrationKey?: string },
  ) {
    if (!canLoad) return;

    const nextTenantId = tenantId.trim();
    const nextSaasId = saasId.trim();
    const key = `${action}:${payload?.automationKey ?? payload?.integrationKey ?? "global"}`;
    setBusyKey(key);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          tenantId: nextTenantId,
          saasId: nextSaasId,
          ...payload,
        }),
      });
      const data = (await response.json().catch(() => null)) as SurfaceResponse | null;

      if (!response.ok || !data?.surface) {
        throw new Error(data?.message ?? "Could not complete operator action.");
      }

      setSurface(data.surface);

      if (action === "refresh") {
        setMessage("Platform state refreshed.");
      } else if (action === "run_automation" && payload?.automationKey) {
        setMessage(`Automation ${payload.automationKey} triggered.`);
      } else if ((action === "enable_automation" || action === "disable_automation") && payload?.automationKey) {
        setMessage(`${payload.automationKey} ${action === "enable_automation" ? "enabled" : "disabled"}.`);
      } else if (action === "validate_integration" && payload?.integrationKey) {
        setMessage(`Integration ${payload.integrationKey} validated.`);
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not complete operator action.");
    } finally {
      setBusyKey(null);
    }
  }

  function handleInspectSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canLoad) return;

    const nextTenantId = tenantId.trim();
    const nextSaasId = saasId.trim();
    router.replace(`/operator/platform?tenantId=${encodeURIComponent(nextTenantId)}&saasId=${encodeURIComponent(nextSaasId)}`);
    void loadSurface(nextTenantId, nextSaasId);
  }

  const refreshAction = (
    <Button
      variant="brand"
      loading={busyKey === "refresh:global"}
      disabled={!canLoad}
      onClick={() => void runAction("refresh")}
    >
      Refresh
    </Button>
  );

  return (
    <div className="space-y-6 p-6">
      <Card
        tone="glass"
        title="Operator Platform Control"
        subtitle="Tenant + SaaS operational surface"
        right={surface ? `${surface.tenantId} / ${surface.saasId}` : "Operator only"}
        actions={refreshAction}
      >
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={handleInspectSubmit}>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Tenant ID</span>
            <input
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500"
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              placeholder="tenant_socialflow"
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>SaaS ID</span>
            <input
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500"
              value={saasId}
              onChange={(event) => setSaasId(event.target.value)}
              placeholder="socialflow"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={!canLoad}>
              Inspect
            </Button>
          </div>
        </form>

        {surface ? (
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Overall status</p>
              <div className="mt-2">
                <Badge variant={badgeForStatus(surface.summary.overallStatus)}>{surface.summary.overallStatus}</Badge>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Last activity</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(surface.summary.latestActivityAt)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Open incidents</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{surface.summary.openIncidentsCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest snapshot</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(surface.summary.latestSnapshotAt)}</p>
            </div>
          </div>
        ) : null}
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

      {loading ? (
        <Card tone="default" title="Platform state" subtitle="Loading operator data">
          <p className="text-sm text-slate-500">Loading platform operator surface...</p>
        </Card>
      ) : !surface ? (
        <EmptyState
          title="Choose a tenant and SaaS"
          subtitle="Inspect a concrete tenant + SaaS pair to load the platform operator surface."
        />
      ) : (
        <>
          <Card tone="default" title="Status Summary" subtitle="Latest operational reading">
            <div className="grid gap-4 md:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Health</p>
                <div className="mt-2">
                  <Badge variant={badgeForStatus(surface.summary.overallStatus)}>{surface.summary.overallStatus}</Badge>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Freshness</p>
                <div className="mt-2">
                  <Badge variant={badgeForStatus(surface.summary.freshnessStatus)}>{surface.summary.freshnessStatus}</Badge>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Open incidents</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{surface.summary.openIncidentsCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest snapshot</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(surface.summary.latestSnapshotAt)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Recommendation</p>
                <p className="mt-2 text-sm text-slate-700">{surface.summary.recommendation}</p>
              </div>
            </div>
          </Card>

          <Card tone="default" title="Automations" subtitle="Registry and manual controls">
            {surface.automations.length === 0 ? (
              <EmptyState
                title="No automations registered"
                subtitle="This SaaS has no automation registrations yet."
              />
            ) : (
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH className="px-4 py-3 text-left">Automation</TH>
                      <TH className="px-4 py-3 text-left">Enabled</TH>
                      <TH className="px-4 py-3 text-left">Frequency</TH>
                      <TH className="px-4 py-3 text-left">Config</TH>
                      <TH className="px-4 py-3 text-left">Last execution</TH>
                      <TH className="px-4 py-3 text-left">Last result</TH>
                      <TH className="px-4 py-3 text-left">Actions</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {surface.automations.map((item) => (
                      <tr key={item.automationKey} className="border-b border-slate-100 last:border-b-0">
                        <TD className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-900">{item.displayName}</p>
                          <p className="text-xs text-slate-500">{item.automationKey}</p>
                        </TD>
                        <TD className="px-4 py-3">
                          <Badge variant={item.enabled ? "ok" : "neutral"}>
                            {item.enabled ? "enabled" : "disabled"}
                          </Badge>
                        </TD>
                        <TD className="px-4 py-3 text-sm text-slate-700">{item.frequencyLabel}</TD>
                        <TD className="px-4 py-3 text-sm text-slate-700">{item.configSummary}</TD>
                        <TD className="px-4 py-3 text-sm text-slate-700">{formatDate(item.lastExecutionAt)}</TD>
                        <TD className="px-4 py-3">
                          <Badge variant={badgeForStatus(item.lastResult)}>{item.lastResult}</Badge>
                          {item.lastSummary ? <p className="mt-2 text-xs text-slate-500">{item.lastSummary}</p> : null}
                        </TD>
                        <TD className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              loading={busyKey === `run_automation:${item.automationKey}`}
                              disabled={!item.enabled}
                              onClick={() => void runAction("run_automation", { automationKey: item.automationKey })}
                            >
                              Run now
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busyKey === `enable_automation:${item.automationKey}`}
                              disabled={item.enabled}
                              onClick={() => void runAction("enable_automation", { automationKey: item.automationKey })}
                            >
                              Enable
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busyKey === `disable_automation:${item.automationKey}`}
                              disabled={!item.enabled}
                              onClick={() => void runAction("disable_automation", { automationKey: item.automationKey })}
                            >
                              Disable
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

          <Card tone="default" title="Integrations" subtitle="Connection state and validation">
            {surface.integrations.length === 0 ? (
              <EmptyState
                title="No integrations connected"
                subtitle="This SaaS has no integration connections yet."
              />
            ) : (
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH className="px-4 py-3 text-left">Integration</TH>
                      <TH className="px-4 py-3 text-left">Status</TH>
                      <TH className="px-4 py-3 text-left">Last validated</TH>
                      <TH className="px-4 py-3 text-left">Last error</TH>
                      <TH className="px-4 py-3 text-left">Action</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {surface.integrations.map((item) => (
                      <tr key={item.integrationKey} className="border-b border-slate-100 last:border-b-0">
                        <TD className="px-4 py-3 text-sm font-semibold text-slate-900">{item.integrationKey}</TD>
                        <TD className="px-4 py-3">
                          <Badge variant={badgeForStatus(item.status)}>{item.status}</Badge>
                        </TD>
                        <TD className="px-4 py-3 text-sm text-slate-700">{formatDate(item.lastValidatedAt)}</TD>
                        <TD className="px-4 py-3 text-sm text-slate-700">{item.lastError ?? "No errors"}</TD>
                        <TD className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            loading={busyKey === `validate_integration:${item.integrationKey}`}
                            onClick={() => void runAction("validate_integration", { integrationKey: item.integrationKey })}
                            aria-label={`Validate integration ${item.integrationKey}`}
                            data-testid={`validate-integration-${item.integrationKey}`}
                          >
                            Validate
                          </Button>
                        </TD>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card tone="default" title="Open Incidents" subtitle="Operational issues requiring attention">
              {surface.openIncidents.length === 0 ? (
                <EmptyState
                  title="No open incidents"
                  subtitle="This SaaS has no open operational incidents right now."
                />
              ) : (
                <TableWrap>
                  <Table>
                    <THead>
                      <tr>
                        <TH className="px-4 py-3 text-left">Severity</TH>
                        <TH className="px-4 py-3 text-left">Incident</TH>
                        <TH className="px-4 py-3 text-left">Source</TH>
                        <TH className="px-4 py-3 text-left">Opened</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {surface.openIncidents.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                          <TD className="px-4 py-3">
                            <Badge variant={badgeForStatus(item.severity)}>{item.severity}</Badge>
                          </TD>
                          <TD className="px-4 py-3">
                            <p className="text-sm font-semibold text-slate-900">{item.incidentType}</p>
                            <p className="text-xs text-slate-500">{item.summary}</p>
                          </TD>
                          <TD className="px-4 py-3 text-sm text-slate-700">{item.sourceType}:{item.sourceKey}</TD>
                          <TD className="px-4 py-3 text-sm text-slate-700">{formatDate(item.openedAt)}</TD>
                        </tr>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              )}
            </Card>

            <Card tone="default" title="Recent Activity" subtitle="Latest operational events">
              {surface.recentActivity.length === 0 ? (
                <EmptyState
                  title="No activity yet"
                  subtitle="No operational activity has been recorded for this SaaS."
                />
              ) : (
                <TableWrap>
                  <Table>
                    <THead>
                      <tr>
                        <TH className="px-4 py-3 text-left">Timestamp</TH>
                        <TH className="px-4 py-3 text-left">Source</TH>
                        <TH className="px-4 py-3 text-left">Type</TH>
                        <TH className="px-4 py-3 text-left">Status</TH>
                        <TH className="px-4 py-3 text-left">Summary</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {surface.recentActivity.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                          <TD className="px-4 py-3 text-sm text-slate-700">{formatDate(item.createdAt)}</TD>
                          <TD className="px-4 py-3 text-sm text-slate-700">{item.sourceType}:{item.sourceKey}</TD>
                          <TD className="px-4 py-3 text-sm text-slate-700">{item.activityType}</TD>
                          <TD className="px-4 py-3">
                            <Badge variant={badgeForStatus(item.status)}>{item.status}</Badge>
                          </TD>
                          <TD className="px-4 py-3 text-sm text-slate-700">{item.summary}</TD>
                        </tr>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
