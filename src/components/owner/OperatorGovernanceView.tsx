"use client";

import { useEffect, useMemo, useState, useCallback, type ChangeEvent } from "react";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/input";
import Select from "@/components/ui/select";
import EmptyState from "@/components/ui/empty-state";
import { TableWrap, Table, THead, TH, TBody, TD } from "@/components/ui/table";
import type { GovernanceRow, GovernanceSummary } from "@/lib/ops/operator-governance-view";
import type { GovernanceAction } from "@/lib/ops/governance-actions";
import { useSearchParams, useRouter } from "next/navigation";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "HEALTHY", label: "Healthy" },
  { value: "WARNING", label: "Warning" },
  { value: "DEGRADED", label: "Degraded" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "UNKNOWN", label: "Unknown" },
];

const severityOptions = [
  { value: "", label: "All severities" },
  { value: "INFO", label: "Info" },
  { value: "WARN", label: "Warn" },
  { value: "ERROR", label: "Error" },
  { value: "CRITICAL", label: "Critical" },
];

const lifecycleOptions = [
  { value: "", label: "Any lifecycle" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
  { value: "provisioning", label: "Provisioning" },
];

const billingOptions = [
  { value: "", label: "Any billing" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "canceled", label: "Canceled" },
];

const provisioningOptions = [
  { value: "", label: "Any provisioning" },
  { value: "SUCCESS", label: "Success" },
  { value: "RUNNING", label: "Running" },
  { value: "DEGRADED", label: "Degraded" },
  { value: "FAILED", label: "Failed" },
  { value: "LOCKED", label: "Locked" },
];

const domainOptions = [
  { value: "", label: "Any domain" },
  { value: "active", label: "Active" },
  { value: "verifying", label: "Verifying" },
  { value: "failed", label: "Failed" },
  { value: "locked", label: "Locked" },
];

type ApiResponse = {
  ok: boolean;
  data: GovernanceRow[];
  summary: GovernanceSummary;
  meta: { total: number; limit: number; offset: number };
  code?: string;
  message?: string;
};

type Filters = {
  status: string;
  severity: string;
  lifecycle: string;
  billing: string;
  provisioning: string;
  domainStatus: string;
  search: string;
  sort: "priority" | "recent";
  limit: number;
  offset: number;
};

const DEFAULT_FILTERS: Filters = {
  status: "",
  severity: "",
  lifecycle: "",
  billing: "",
  provisioning: "",
  domainStatus: "",
  search: "",
  sort: "priority",
  limit: 20,
  offset: 0,
};

type GovernanceRowWithActions = GovernanceRow & {
  actions: GovernanceAction[];
  diagnosticSummary: string;
};

function toneForSeverity(sev: GovernanceRow["severity"]): "ok" | "warn" | "err" {
  if (sev === "CRITICAL") return "err";
  if (sev === "ERROR") return "err";
  if (sev === "WARN") return "warn";
  return "ok";
}

function toneForStatus(status: GovernanceRow["overallGovernanceStatus"]): "ok" | "warn" | "err" | "neutral" {
  if (status === "BLOCKED") return "err";
  if (status === "DEGRADED") return "err";
  if (status === "WARNING") return "warn";
  if (status === "HEALTHY") return "ok";
  return "neutral";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function OperatorGovernanceView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<GovernanceRowWithActions[]>([]);
  const [summary, setSummary] = useState<GovernanceSummary>({ total: 0, healthy: 0, warnings: 0, degraded: 0, blocked: 0, verifyingDomains: 0, provisioningRunning: 0, auditStale: 0, billingIssues: 0, lifecycleMismatches: 0, criticalBlockers: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GovernanceRowWithActions | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.lifecycle) params.set("lifecycle", filters.lifecycle);
    if (filters.billing) params.set("billing", filters.billing);
    if (filters.provisioning) params.set("provisioning", filters.provisioning);
    if (filters.domainStatus) params.set("domainStatus", filters.domainStatus);
    if (filters.search) params.set("search", filters.search);
    params.set("sort", filters.sort);
    params.set("limit", String(filters.limit));
    params.set("offset", String(filters.offset));
    return params.toString();
  }, [filters]);

  // Initialize from URL
  useEffect(() => {
    if (!searchParams) return;
    const next: Filters = { ...DEFAULT_FILTERS };
    next.status = searchParams.get("status") ?? "";
    next.severity = searchParams.get("severity") ?? "";
    next.lifecycle = searchParams.get("lifecycle") ?? "";
    next.billing = searchParams.get("billing") ?? "";
    next.provisioning = searchParams.get("provisioning") ?? "";
    next.domainStatus = searchParams.get("domainStatus") ?? "";
    next.search = searchParams.get("search") ?? "";
    next.sort = (searchParams.get("sort") as Filters["sort"]) ?? "priority";
    next.limit = Number(searchParams.get("limit") ?? DEFAULT_FILTERS.limit);
    next.offset = Number(searchParams.get("offset") ?? DEFAULT_FILTERS.offset);
    setFilters(next);
  }, [searchParams]);

  const syncUrl = useCallback(
    (qs: string) => {
      const base = "?" + qs;
      router.replace(base);
    },
    [router],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/owner/governance?${queryString}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) {
        throw new Error(json.message || json.code || "Failed to load governance view");
      }
      const data = json.data as GovernanceRowWithActions[];
      setRows(data);
      // keep selection in sync if same saasSlug
      if (selected) {
        const refreshed = data.find((r) => r.saasSlug === selected.saasSlug);
        setSelected(refreshed ?? null);
      }
      setSummary(json.summary);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    syncUrl(queryString);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, offset: key === "offset" ? (value as number) : 0 }));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    syncUrl("");
  }

  function exportCsv() {
    const header = [
      "saasSlug",
      "saasName",
      "instanceId",
      "domainId",
      "tenantId",
      "lifecycleStatus",
      "billingStatus",
      "provisioningStatus",
      "domainStatus",
      "auditStatus",
      "overallGovernanceStatus",
      "severity",
      "topIssue",
      "blockers",
      "warnings",
      "recommendations",
      "lastEventAt",
      "lastAuditAt",
      "lastBillingAt",
      "lastProvisioningAt",
    ];
    const lines = rows.map((r) =>
      [
        r.saasSlug,
        r.saasName ?? "",
        r.instanceId ?? "",
        r.domainId ?? "",
        r.tenantId ?? "",
        r.lifecycleStatus ?? "",
        r.billingStatus ?? "",
        r.provisioningStatus ?? "",
        r.domainStatus ?? "",
        r.auditStatus ?? "",
        r.overallGovernanceStatus,
        r.severity,
        r.topIssue ?? "",
        r.blockers.join(" | "),
        r.warnings.join(" | "),
        r.recommendations.join(" | "),
        r.lastEventAt ?? "",
        r.lastAuditAt ?? "",
        r.lastBillingAt ?? "",
        r.lastProvisioningAt ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `governance_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasData = rows.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-5">
        <Card tone="glass" className="p-4">
          <div className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em]">Total</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{summary.total}</div>
        </Card>
        <Card tone="glass" className="p-4">
          <div className="text-[10px] font-bold uppercase text-emerald-600 tracking-[0.2em]">Healthy</div>
          <div className="mt-1 text-2xl font-black text-emerald-700">{summary.healthy}</div>
        </Card>
        <Card tone="glass" className="p-4">
          <div className="text-[10px] font-bold uppercase text-amber-600 tracking-[0.2em]">Warnings</div>
          <div className="mt-1 text-2xl font-black text-amber-700">{summary.warnings}</div>
        </Card>
        <Card tone="glass" className="p-4">
          <div className="text-[10px] font-bold uppercase text-red-600 tracking-[0.2em]">Degraded</div>
          <div className="mt-1 text-2xl font-black text-red-700">{summary.degraded}</div>
        </Card>
        <Card tone="glass" className="p-4">
          <div className="text-[10px] font-bold uppercase text-red-800 tracking-[0.2em]">Blocked</div>
          <div className="mt-1 text-2xl font-black text-red-800">{summary.blocked}</div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="warn">Verifying domains: {summary.verifyingDomains}</Badge>
        <Badge variant="warn">Provisioning running: {summary.provisioningRunning}</Badge>
        <Badge variant="outline">Audit stale: {summary.auditStale}</Badge>
        <Badge variant="err">Billing issues: {summary.billingIssues}</Badge>
        <Badge variant="warn">Lifecycle mismatches: {summary.lifecycleMismatches}</Badge>
        <Badge variant="err">Critical blockers: {summary.criticalBlockers}</Badge>
      </div>

      <Card tone="glass" className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Overall">
            <Select
              value={filters.status}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => updateFilter("status", e.target.value)}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Severity">
            <Select value={filters.severity} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateFilter("severity", e.target.value)}>
              {severityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lifecycle">
            <Select value={filters.lifecycle} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateFilter("lifecycle", e.target.value)}>
              {lifecycleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Billing">
            <Select value={filters.billing} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateFilter("billing", e.target.value)}>
              {billingOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Provisioning">
            <Select value={filters.provisioning} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateFilter("provisioning", e.target.value)}>
              {provisioningOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Domain">
            <Select value={filters.domainStatus} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateFilter("domainStatus", e.target.value)}>
              {domainOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Search">
            <TextInput value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Search SaaS, domain, signals" />
          </Field>
          <Field label="Sort">
            <Select
              value={filters.sort}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => updateFilter("sort", (e.target.value as "priority" | "recent") ?? "priority")}
            >
              <option value="priority">Priority</option>
              <option value="recent">Recent</option>
            </Select>
          </Field>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || undefined}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button variant="ghost" size="sm" onClick={resetFilters}>Reset</Button>
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
        </div>
      </Card>

      <Card tone="glass" className="p-0">
        {loading && (
          <div className="flex items-center gap-3 p-6 text-sm text-slate-600">
            <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" /> Loading governance data...
          </div>
        )}
        {error && (
          <div className="p-6 text-sm text-red-600 border-b border-red-100 bg-red-50">{error}</div>
        )}
        {!loading && !hasData && !error && <EmptyState title="No governance signals" subtitle="Adjust filters or refresh to load data." />}

        {hasData && (
          <div className="grid md:grid-cols-[2fr_1fr] gap-0">
            <div className="border-r border-[var(--border)]/70">
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH className="px-4 py-3 text-left">SaaS</TH>
                      <TH className="px-4 py-3 text-left">Instance</TH>
                      <TH className="px-4 py-3 text-left">Domain</TH>
                      <TH className="px-4 py-3 text-left">Lifecycle</TH>
                      <TH className="px-4 py-3 text-left">Billing</TH>
                      <TH className="px-4 py-3 text-left">Provisioning</TH>
                      <TH className="px-4 py-3 text-left">Audit</TH>
                      <TH className="px-4 py-3 text-left">Overall</TH>
                      <TH className="px-4 py-3 text-left">Last Activity</TH>
                      <TH className="px-4 py-3 text-left">Top Issue</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {rows.map((row) => (
                      <tr
                        key={row.saasSlug}
                        className="cursor-pointer hover:bg-[var(--panel)]/60"
                        onClick={() => setSelected(row)}
                        data-testid={`row-${row.saasSlug}`}
                      >
                        <TD className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{row.saasName ?? row.saasSlug}</div>
                          <div className="text-xs text-slate-500 font-mono">{row.saasSlug}</div>
                        </TD>
                        <TD className="px-4 py-3 font-mono text-xs text-slate-600">{row.instanceId ?? "—"}</TD>
                        <TD className="px-4 py-3 font-mono text-xs text-slate-600">{row.domainId ?? "—"}</TD>
                        <TD className="px-4 py-3"><Badge>{row.lifecycleStatus ?? "—"}</Badge></TD>
                        <TD className="px-4 py-3"><Badge>{row.billingStatus ?? "—"}</Badge></TD>
                        <TD className="px-4 py-3"><Badge>{row.provisioningStatus ?? "—"}</Badge></TD>
                        <TD className="px-4 py-3"><Badge>{row.auditStatus ?? "—"}</Badge></TD>
                        <TD className="px-4 py-3">
                          <Badge
                            className="font-semibold"
                            variant={toneForStatus(row.overallGovernanceStatus) === "err" ? "err" : toneForStatus(row.overallGovernanceStatus) === "warn" ? "warn" : toneForStatus(row.overallGovernanceStatus) === "ok" ? "ok" : "neutral"}
                          >
                            {row.overallGovernanceStatus}
                          </Badge>
                        </TD>
                        <TD className="px-4 py-3 text-xs font-mono text-slate-600">{formatDate(row.lastEventAt)}</TD>
                        <TD className="px-4 py-3 text-xs text-slate-600">{row.topIssue ?? "—"}</TD>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
              <div className="flex items-center justify-between p-4 text-sm text-slate-600">
                <div>
                  Showing {Math.min(filters.offset + 1, summary.total)} - {Math.min(filters.offset + filters.limit, summary.total)} of {summary.total}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.offset <= 0}
                    onClick={() => updateFilter("offset", Math.max(0, filters.offset - filters.limit))}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.offset + filters.limit >= summary.total}
                    onClick={() => updateFilter("offset", filters.offset + filters.limit)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 min-h-[320px]">
              {!selected ? (
                <div className="text-sm text-slate-500">Select a row to inspect signals and recommendations.</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-mono text-slate-500">{selected.saasSlug}</div>
                      <div className="text-xl font-black text-slate-900">{selected.saasName ?? selected.saasSlug}</div>
                    </div>
                    <Badge
                      className="font-semibold"
                      variant={toneForSeverity(selected.severity) === "err" ? "err" : toneForSeverity(selected.severity) === "warn" ? "warn" : "ok"}
                    >
                      {selected.severity}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>Instance: <span className="font-mono" title={selected.instanceId ?? undefined}>{selected.instanceId ?? "—"}</span></div>
                    <div>Domain: <span className="font-mono" title={selected.domainId ?? undefined}>{selected.domainId ?? "—"}</span></div>
                    <div>Tenant: <span className="font-mono" title={selected.tenantId ?? undefined}>{selected.tenantId ?? "—"}</span></div>
                    <div>Lifecycle: <span className="font-mono">{selected.lifecycleStatus ?? "—"}</span></div>
                    <div>Billing: <span className="font-mono">{selected.billingStatus ?? "—"}</span></div>
                    <div>Provisioning: <span className="font-mono">{selected.provisioningStatus ?? "—"}</span></div>
                    <div>Domain status: <span className="font-mono">{selected.domainStatus ?? "—"}</span></div>
                    <div>Audit: <span className="font-mono">{selected.auditStatus ?? "—"}</span></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                    <div>
                      <div className="text-[11px] font-bold uppercase text-slate-500">Blockers</div>
                      <ul className="mt-1 space-y-1">
                        {(selected.blockers.length ? selected.blockers : ["None"]).map((b, idx) => (
                          <li key={`blocker-${idx}`} className="rounded bg-red-50 text-red-700 px-2 py-1 border border-red-100">
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase text-slate-500">Warnings</div>
                      <ul className="mt-1 space-y-1">
                        {(selected.warnings.length ? selected.warnings : ["None"]).map((w, idx) => (
                          <li key={`warn-${idx}`} className="rounded bg-amber-50 text-amber-800 px-2 py-1 border border-amber-100">
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase text-slate-500">Recommendations</div>
                    <ul className="mt-1 space-y-1 text-xs text-slate-700">
                      {(selected.recommendations.length ? selected.recommendations : ["No recommendations"]).map((rec, idx) => (
                        <li key={`rec-${idx}`} className="rounded bg-slate-50 px-2 py-1 border border-slate-200">
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>Last activity: {formatDate(selected.lastEventAt)}</div>
                    <div>Last audit: {formatDate(selected.lastAuditAt)}</div>
                    <div>Last provisioning: {formatDate(selected.lastProvisioningAt)}</div>
                    <div>Last billing: {formatDate(selected.lastBillingAt)}</div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase text-slate-500">Related links</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <Button variant="ghost" size="sm" onClick={() => window.open(`/owner/projects/${selected.saasSlug}`, "_blank")}>SaaS</Button>
                      <Button variant="ghost" size="sm" onClick={() => selected.domainId ? window.open(`/owner/domains/${selected.domainId}`, "_blank") : undefined} disabled={!selected.domainId}>Domain</Button>
                      <Button variant="ghost" size="sm" onClick={() => window.open(`/owner/factory/jobs?saas=${selected.saasSlug}`, "_blank")}>Provisioning</Button>
                      <Button variant="ghost" size="sm" onClick={() => window.open(`/owner/billing?saas=${selected.saasSlug}`, "_blank")}>Billing</Button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase text-slate-500">Signals</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selected.signals.map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <div className="text-[11px] font-bold uppercase text-slate-500">Alerts context</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`/owner/governance/alerts?saasSlug=${selected.saasSlug}`, "_blank")}
                    >
                      Open alerts
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold uppercase text-slate-500">Diagnostic summary</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(selected.diagnosticSummary)}
                      >
                        Copy
                      </Button>
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                      {selected.diagnosticSummary}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase text-slate-500">Available actions</div>
                    <div className="mt-2 space-y-2">
                      {selected.actions.map((action: GovernanceAction) => (
                        <div key={action.id} className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800">{action.label}</span>
                            {action.reasonIfDisabled && !action.enabled && (
                              <span className="text-[11px] text-slate-500">{action.reasonIfDisabled}</span>
                            )}
                          </div>
                          {action.href ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!action.enabled}
                              onClick={() => action.href && window.open(action.href, "_blank")}
                            >
                              Open
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled={!action.enabled}>
                              {action.kind === "safe_trigger" ? "Trigger" : "Do"}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
