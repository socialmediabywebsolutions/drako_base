"use client";

import { useEffect, useState } from "react";
import type {
  CampoBaseSocialAutomationBatchOutput,
  CampoBaseSocialAutomationOutput,
  CampoBaseSocialAutomationStatusOutput,
} from "@/lib/campobase/socialflow-service";
import type { CampoBaseSocialAutomationRun } from "@/lib/campobase/social-automation-history";

type ControlResponse = {
  status?: CampoBaseSocialAutomationStatusOutput;
  history?: CampoBaseSocialAutomationRun[];
  summary?: HistorySummary;
  result?: CampoBaseSocialAutomationBatchOutput | CampoBaseSocialAutomationOutput;
  message?: string;
  code?: string;
};

const endpoint = "/api/campobase/socialflow";

type HistoryFilter = {
  tenantId?: string;
  saasId?: string;
  status?: "SUCCESS" | "FAILED";
  dateFrom?: string;
  dateTo?: string;
} | null | undefined;

type HistorySummary = {
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  successRate: number;
  failedRate: number;
  totalPosts: number;
  totalScheduled: number;
  latestRunAt: string | null;
  latestFailedRunAt: string | null;
};

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatDurationSeconds(startedAt: string, finishedAt: string) {
  const start = Date.parse(startedAt);
  const end = Date.parse(finishedAt);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return "—";
  }
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  return `${seconds}s`;
}

function buildHistorySummary(history: CampoBaseSocialAutomationRun[]): HistorySummary {
  let successRuns = 0;
  let failedRuns = 0;
  let totalPosts = 0;
  let totalScheduled = 0;
  let latestRunAt: string | null = null;
  let latestFailedRunAt: string | null = null;
  let latestRunTime = -Infinity;
  let latestFailedTime = -Infinity;

  for (const item of history) {
    if (item.status === "SUCCESS") {
      successRuns += 1;
    } else if (item.status === "FAILED") {
      failedRuns += 1;
    }

    totalPosts += Number.isFinite(item.postsCount) ? item.postsCount : 0;
    totalScheduled += Number.isFinite(item.scheduledCount) ? item.scheduledCount : 0;

    const createdAt = Date.parse(item.createdAt);
    if (!Number.isNaN(createdAt)) {
      if (createdAt > latestRunTime) {
        latestRunTime = createdAt;
        latestRunAt = item.createdAt;
      }
      if (item.status === "FAILED" && createdAt > latestFailedTime) {
        latestFailedTime = createdAt;
        latestFailedRunAt = item.createdAt;
      }
    }
  }

  const totalRuns = history.length;

  return {
    totalRuns,
    successRuns,
    failedRuns,
    successRate: totalRuns ? successRuns / totalRuns : 0,
    failedRate: totalRuns ? failedRuns / totalRuns : 0,
    totalPosts,
    totalScheduled,
    latestRunAt,
    latestFailedRunAt,
  };
}

function buildHistoryFilter(options: {
  tenantId?: string | null;
  saasId?: string | null;
  status?: "ALL" | "SUCCESS" | "FAILED";
  dateFrom?: string;
  dateTo?: string;
}) {
  const filter: {
    tenantId?: string;
    saasId?: string;
    status?: "SUCCESS" | "FAILED";
    dateFrom?: string;
    dateTo?: string;
  } = {};

  if (options.tenantId && options.saasId) {
    filter.tenantId = options.tenantId;
    filter.saasId = options.saasId;
  }

  if (options.status === "SUCCESS" || options.status === "FAILED") {
    filter.status = options.status;
  }

  if (options.dateFrom) {
    filter.dateFrom = options.dateFrom;
  }

  if (options.dateTo) {
    filter.dateTo = options.dateTo;
  }

  return Object.keys(filter).length ? filter : null;
}

function buildHistoryUrl(filter?: HistoryFilter) {
  if (!filter) {
    return endpoint;
  }
  const params = new URLSearchParams();
  if (filter.tenantId) {
    params.set("tenantId", filter.tenantId);
  }
  if (filter.saasId) {
    params.set("saasId", filter.saasId);
  }
  if (filter.status) {
    params.set("status", filter.status);
  }
  if (filter.dateFrom) {
    params.set("dateFrom", filter.dateFrom);
  }
  if (filter.dateTo) {
    params.set("dateTo", filter.dateTo);
  }
  return `${endpoint}?${params.toString()}`;
}

async function fetchStatus(filter?: HistoryFilter): Promise<ControlResponse> {
  const response = await fetch(buildHistoryUrl(filter), { cache: "no-store" });
  const data = (await response.json().catch(() => null)) as ControlResponse | null;

  if (!response.ok || !data?.status) {
    throw new Error(data?.message ?? "LOAD_ERROR");
  }

  return data;
}

async function postAction(
  action: "run_all" | "run_one" | "enable" | "disable",
  payload?: { tenantId: string; saasId: string },
): Promise<ControlResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = (await response.json().catch(() => null)) as ControlResponse | null;

  if (!response.ok || !data?.status) {
    throw new Error(data?.message ?? "ACTION_ERROR");
  }

  return data;
}

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        enabled
          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
          : "border-rose-400/40 bg-rose-500/15 text-rose-300",
      ].join(" ")}
    >
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

export default function CampoBaseSocialPage() {
  const [status, setStatus] = useState<CampoBaseSocialAutomationStatusOutput | null>(null);
  const [batch, setBatch] = useState<CampoBaseSocialAutomationBatchOutput | null>(null);
  const [history, setHistory] = useState<CampoBaseSocialAutomationRun[]>([]);
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SUCCESS" | "FAILED">("ALL");
  const [dateFromFilter, setDateFromFilter] = useState<string>("");
  const [dateToFilter, setDateToFilter] = useState<string>("");
  const [appliedStatus, setAppliedStatus] = useState<"ALL" | "SUCCESS" | "FAILED">("ALL");
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>("");
  const [appliedDateTo, setAppliedDateTo] = useState<string>("");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedSaasId, setSelectedSaasId] = useState<string | null>(null);

  function getActiveFilter(): HistoryFilter {
    return buildHistoryFilter({
      tenantId: selectedTenantId,
      saasId: selectedSaasId,
      status: appliedStatus,
      dateFrom: appliedDateFrom,
      dateTo: appliedDateTo,
    });
  }

  async function refreshStatus(filter?: HistoryFilter) {
    setLoading(true);
    const effectiveFilter = filter === undefined ? getActiveFilter() : filter;
    try {
      const data = await fetchStatus(effectiveFilter);
      setStatus(data.status ?? null);
      setHistory(data.history ?? []);
      setSummary(data.summary ?? buildHistorySummary(data.history ?? []));
      setError(null);
    } catch (loadError) {
      setStatus(null);
      setHistory([]);
      setSummary(null);
      setError(loadError instanceof Error ? loadError.message : "LOAD_ERROR");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function handleRunAll() {
    setBusy("run_all");
    setError(null);
    try {
      const data = await postAction("run_all");
      if (!data.result || !("success" in data.result)) {
        throw new Error(data.message ?? "RUN_ALL_ERROR");
      }
      setBatch(data.result as CampoBaseSocialAutomationBatchOutput);
      setStatus(data.status ?? null);
      void refreshStatus(getActiveFilter());
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "RUN_ALL_ERROR");
    } finally {
      setBusy(null);
    }
  }

  async function handleRunOne(tenantId: string, saasId: string) {
    setBusy(`run:${saasId}`);
    setError(null);
    try {
      const data = await postAction("run_one", { tenantId, saasId });
      const result = data.result as CampoBaseSocialAutomationOutput | undefined;
      if (!result) {
        throw new Error(data.message ?? "RUN_ONE_ERROR");
      }
      setBatch({
        total: 1,
        success: 1,
        failed: 0,
        results: [
          {
            tenantId,
            saasId,
            ok: true,
            campaignId: result.campaignId,
            postsCount: result.postsCount,
            scheduledCount: result.scheduledCount,
            error: null,
          },
        ],
      });
      setStatus(data.status ?? null);
      setSelectedTenantId(tenantId);
      setSelectedSaasId(saasId);
      void refreshStatus(buildHistoryFilter({
        tenantId,
        saasId,
        status: appliedStatus,
        dateFrom: appliedDateFrom,
        dateTo: appliedDateTo,
      }));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "RUN_ONE_ERROR");
    } finally {
      setBusy(null);
    }
  }

  async function handleEnable(tenantId: string, saasId: string) {
    setBusy(`enable:${tenantId}:${saasId}`);
    setError(null);
    try {
      const data = await postAction("enable", { tenantId, saasId });
      setStatus(data.status ?? null);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "ENABLE_ERROR");
    } finally {
      setBusy(null);
    }
  }

  async function handleDisable(tenantId: string, saasId: string) {
    setBusy(`disable:${tenantId}:${saasId}`);
    setError(null);
    try {
      const data = await postAction("disable", { tenantId, saasId });
      setStatus(data.status ?? null);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "DISABLE_ERROR");
    } finally {
      setBusy(null);
    }
  }

  async function handleViewHistory(tenantId: string, saasId: string) {
    setSelectedTenantId(tenantId);
    setSelectedSaasId(saasId);
    await refreshStatus(buildHistoryFilter({
      tenantId,
      saasId,
      status: appliedStatus,
      dateFrom: appliedDateFrom,
      dateTo: appliedDateTo,
    }));
  }

  async function handleClearFilter() {
    setSelectedTenantId(null);
    setSelectedSaasId(null);
    await refreshStatus(buildHistoryFilter({
      status: appliedStatus,
      dateFrom: appliedDateFrom,
      dateTo: appliedDateTo,
    }));
  }

  async function handleApplyFilters() {
    setAppliedStatus(statusFilter);
    setAppliedDateFrom(dateFromFilter);
    setAppliedDateTo(dateToFilter);
    await refreshStatus(buildHistoryFilter({
      tenantId: selectedTenantId,
      saasId: selectedSaasId,
      status: statusFilter,
      dateFrom: dateFromFilter,
      dateTo: dateToFilter,
    }));
  }

  async function handleResetFilters() {
    setStatusFilter("ALL");
    setDateFromFilter("");
    setDateToFilter("");
    setAppliedStatus("ALL");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    await refreshStatus(buildHistoryFilter({
      tenantId: selectedTenantId,
      saasId: selectedSaasId,
      status: "ALL",
    }));
  }

  async function handleRetry(run: CampoBaseSocialAutomationRun) {
    setBusy(`retry:${run.id}`);
    setError(null);
    try {
      const data = await postAction("run_one", { tenantId: run.tenantId, saasId: run.saasId });
      const result = data.result as CampoBaseSocialAutomationOutput | undefined;
      if (!result) {
        throw new Error(data.message ?? "RETRY_ERROR");
      }
      setBatch({
        total: 1,
        success: 1,
        failed: 0,
        results: [
          {
            tenantId: run.tenantId,
            saasId: run.saasId,
            ok: true,
            campaignId: result.campaignId,
            postsCount: result.postsCount,
            scheduledCount: result.scheduledCount,
            error: null,
          },
        ],
      });
      setStatus(data.status ?? null);
      void refreshStatus(getActiveFilter());
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "RETRY_ERROR");
    } finally {
      setBusy(null);
    }
  }

  async function handleRetryFailedVisible() {
    const uniqueFailedRuns = new Map<string, CampoBaseSocialAutomationRun>();
    for (const run of history) {
      if (run.status !== "FAILED") {
        continue;
      }
      const key = `${run.tenantId}:${run.saasId}`;
      if (!uniqueFailedRuns.has(key)) {
        uniqueFailedRuns.set(key, run);
      }
    }
    if (!uniqueFailedRuns.size) {
      return;
    }
    setBusy("retry_failed_visible");
    setError(null);
    try {
      for (const run of uniqueFailedRuns.values()) {
        await postAction("run_one", { tenantId: run.tenantId, saasId: run.saasId });
      }
      await refreshStatus(getActiveFilter());
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "RETRY_FAILED_VISIBLE_ERROR");
    } finally {
      setBusy(null);
    }
  }

  const tenantFilterActive = Boolean(selectedTenantId && selectedSaasId);
  const statusFilterActive = appliedStatus !== "ALL";
  const dateFilterActive = Boolean(appliedDateFrom || appliedDateTo);
  const filterActive = tenantFilterActive || statusFilterActive || dateFilterActive;
  const failedVisible = history.filter((item) => item.status === "FAILED");
  const failedHighlights = failedVisible.slice(0, 5);
  const summaryData = summary ?? buildHistorySummary(history);
  const summarySuccessRate = `${Math.round(summaryData.successRate * 100)}%`;
  let filterLabel = "Global history";
  if (tenantFilterActive) {
    filterLabel = `Filtered by ${selectedSaasId}`;
  } else if (filterActive) {
    filterLabel = "Filtered history";
  }

  return (
    <div className="min-h-screen bg-[#0a1018] px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(135deg,#0f172a_0%,#111827_55%,#0b1220_100%)] p-8 shadow-[0_30px_80px_rgba(2,8,23,0.45)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-300/80">Campo Base</p>
              <h1 className="text-3xl font-semibold tracking-tight text-white">Campo Base — Social Automation</h1>
              <p className="max-w-2xl text-sm text-slate-300">Control global de automatización de redes</p>
            </div>
            <button
              type="button"
              onClick={() => void handleRunAll()}
              disabled={busy === "run_all"}
              className="inline-flex items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "run_all" ? "Running..." : "Run ALL"}
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Total</p>
            <p className="mt-3 text-3xl font-semibold text-white">{status?.total ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Enabled</p>
            <p className="mt-3 text-3xl font-semibold text-white">{status?.enabled ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-rose-300">Disabled</p>
            <p className="mt-3 text-3xl font-semibold text-white">{status?.disabled ?? 0}</p>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </section>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 shadow-[0_20px_60px_rgba(2,8,23,0.35)]">
          <div className="border-b border-slate-800 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">SaaS registrados</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">SaaS ID</th>
                  <th className="px-4 py-3">Tenant ID</th>
                  <th className="px-4 py-3">Enabled</th>
                  <th className="px-4 py-3">Niche</th>
                  <th className="px-4 py-3">Tone</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Última actualización</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                      Cargando...
                    </td>
                  </tr>
                ) : status?.items.length ? (
                  status.items.map((item) => (
                    <tr key={`${item.tenantId}:${item.saasId}`} className="border-t border-slate-800/80 align-top">
                      <td className="px-4 py-4 font-medium text-white">{item.saasId}</td>
                      <td className="px-4 py-4 text-slate-300">{item.tenantId}</td>
                      <td className="px-4 py-4">
                        <EnabledBadge enabled={item.enabled} />
                      </td>
                      <td className="px-4 py-4 text-slate-300">{item.niche}</td>
                      <td className="px-4 py-4 text-slate-300">{item.tone}</td>
                      <td className="px-4 py-4 text-slate-300">{item.frequencyPerWeek}</td>
                      <td className="px-4 py-4 text-slate-300">{formatDate(item.updatedAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleEnable(item.tenantId, item.saasId)}
                            disabled={busy === `enable:${item.tenantId}:${item.saasId}` || item.enabled}
                            className="rounded-full border border-emerald-500/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 transition hover:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Enable
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDisable(item.tenantId, item.saasId)}
                            disabled={busy === `disable:${item.tenantId}:${item.saasId}` || !item.enabled}
                            className="rounded-full border border-rose-500/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-300 transition hover:border-rose-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Disable
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRunOne(item.tenantId, item.saasId)}
                            disabled={busy === `run:${item.saasId}`}
                            className="rounded-full border border-sky-500/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300 transition hover:border-sky-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Run
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleViewHistory(item.tenantId, item.saasId)}
                            className="rounded-full border border-slate-500/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-slate-400/60"
                          >
                            View history
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                      No hay SaaS registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Total runs</p>
            <p className="mt-3 text-2xl font-semibold text-white">{summaryData.totalRuns}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-300">Success</p>
            <p className="mt-3 text-2xl font-semibold text-white">{summaryData.successRuns}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-rose-300">Failed</p>
            <p className="mt-3 text-2xl font-semibold text-white">{summaryData.failedRuns}</p>
          </div>
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-sky-200">Success rate</p>
            <p className="mt-3 text-2xl font-semibold text-white">{summarySuccessRate}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Total posts</p>
            <p className="mt-3 text-2xl font-semibold text-white">{summaryData.totalPosts}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Total scheduled</p>
            <p className="mt-3 text-2xl font-semibold text-white">{summaryData.totalScheduled}</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 shadow-[0_20px_60px_rgba(2,8,23,0.35)]">
          <div className="border-b border-slate-800 px-6 py-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold text-white">Historial de ejecuciones</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <span>{filterLabel}</span>
                {tenantFilterActive ? (
                  <button
                    type="button"
                    onClick={() => void handleClearFilter()}
                    className="rounded-full border border-slate-500/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-400/60"
                  >
                    Clear filter
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="border-b border-slate-800 px-6 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-wrap gap-4">
                <div className="space-y-2">
                  <label htmlFor="history-status" className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    Status
                  </label>
                  <select
                    id="history-status"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as "ALL" | "SUCCESS" | "FAILED")}
                    className="w-40 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="ALL">All</option>
                    <option value="SUCCESS">Success</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="history-date-from" className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    Date from
                  </label>
                  <input
                    id="history-date-from"
                    type="date"
                    value={dateFromFilter}
                    onChange={(event) => setDateFromFilter(event.target.value)}
                    className="w-44 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="history-date-to" className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    Date to
                  </label>
                  <input
                    id="history-date-to"
                    type="date"
                    value={dateToFilter}
                    onChange={(event) => setDateToFilter(event.target.value)}
                    className="w-44 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleApplyFilters()}
                  className="rounded-full border border-sky-500/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200 transition hover:border-sky-400/60"
                >
                  Apply filters
                </button>
                <button
                  type="button"
                  onClick={() => void handleResetFilters()}
                  className="rounded-full border border-slate-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-400/60"
                >
                  Reset filters
                </button>
                <button
                  type="button"
                  onClick={() => void handleRetryFailedVisible()}
                  disabled={busy === "retry_failed_visible" || failedVisible.length === 0}
                  className="rounded-full border border-amber-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200 transition hover:border-amber-300/70 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === "retry_failed_visible" ? "Retrying..." : "Retry failed visible"}
                </button>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-800 px-6 py-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-300">Failed highlights</h3>
                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Latest 5 failed
                </span>
              </div>
              {failedHighlights.length ? (
                <div className="grid gap-2">
                  {failedHighlights.map((item) => (
                    <div
                      key={`failed:${item.id}`}
                      className="flex flex-col gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-[0.2em] text-rose-200">{item.saasId}</span>
                        <span className="text-xs text-rose-100/80">{item.error ?? "—"}</span>
                        <span className="text-[11px] text-rose-200/70">{formatDate(item.createdAt)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRetry(item)}
                        disabled={busy === `retry:${item.id}`}
                        className="w-fit rounded-full border border-rose-200/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-100 transition hover:border-rose-200/80 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Retry
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No failed runs in current filters.</p>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">SaaS ID</th>
                  <th className="px-4 py-3">Tenant ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Posts</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Error</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Finished</th>
                  <th className="px-4 py-3">Duration (s)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                      Cargando...
                    </td>
                  </tr>
                ) : history.length ? (
                  history.map((item) => (
                    <tr key={item.id} className="border-t border-slate-800/80 align-top">
                      <td className="px-4 py-4 text-white">{item.saasId}</td>
                      <td className="px-4 py-4 text-slate-300">{item.tenantId}</td>
                      <td className="px-4 py-4">
                        <span
                          className={[
                            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                            item.status === "SUCCESS"
                              ? "border-emerald-300/70 bg-emerald-400/20 text-emerald-100"
                              : "border-rose-300/70 bg-rose-400/20 text-rose-100",
                          ].join(" ")}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-300">{item.campaignId ?? "—"}</td>
                      <td className="px-4 py-4 text-slate-300">{item.postsCount}</td>
                      <td className="px-4 py-4 text-slate-300">{item.scheduledCount}</td>
                      <td className="px-4 py-4 text-slate-300">
                        <div className="flex flex-col gap-2">
                          <span>{item.error ?? "—"}</span>
                          {item.status === "FAILED" && item.error ? (
                            <button
                              type="button"
                              onClick={() => void handleRetry(item)}
                              disabled={busy === `retry:${item.id}`}
                              className="w-fit rounded-full border border-amber-400/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200 transition hover:border-amber-300/70 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Retry run
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-300">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-4 text-slate-300">{formatDate(item.finishedAt)}</td>
                      <td className="px-4 py-4 text-slate-300">
                        {formatDurationSeconds(item.startedAt, item.finishedAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                      {filterActive ? "No executions match current filters." : "Sin historial todavía."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-[0_20px_60px_rgba(2,8,23,0.35)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Estado batch</h2>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300">
                total: {batch?.total ?? 0}
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                success: {batch?.success ?? 0}
              </span>
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-rose-300">
                failed: {batch?.failed ?? 0}
              </span>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">SaaS ID</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Posts</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {batch?.results.length ? (
                  batch.results.map((item) => (
                    <tr key={`${item.tenantId}:${item.saasId}:${item.campaignId ?? "no_campaign"}`} className="border-t border-slate-800/80">
                      <td className="px-4 py-4 text-white">{item.saasId}</td>
                      <td className="px-4 py-4">
                        <span
                          className={[
                            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                            item.ok
                              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                              : "border-rose-400/30 bg-rose-500/10 text-rose-300",
                          ].join(" ")}
                        >
                          {item.ok ? "ok" : "failed"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-300">{item.postsCount}</td>
                      <td className="px-4 py-4 text-slate-300">{item.scheduledCount}</td>
                      <td className="px-4 py-4 text-slate-300">{item.error ?? "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      Sin ejecuciones todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
