"use client";

import { useEffect, useMemo, useState, useCallback, type ChangeEvent } from "react";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/input";
import Select from "@/components/ui/select";
import EmptyState from "@/components/ui/empty-state";
import { TableWrap, Table, THead, TH, TBody, TD } from "@/components/ui/table";
import { useRouter, useSearchParams } from "next/navigation";
import type { GovernanceAlert, GovernanceAlertSummary } from "@/lib/ops/governance-alerts";

const severityOptions = [
  { value: "", label: "All severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "ERROR", label: "Error" },
  { value: "WARN", label: "Warning" },
  { value: "INFO", label: "Info" },
];

const categoryOptions = [
  { value: "", label: "All categories" },
  { value: "billing", label: "Billing" },
  { value: "provisioning", label: "Provisioning" },
  { value: "domain", label: "Domain" },
  { value: "lifecycle", label: "Lifecycle" },
  { value: "audit", label: "Audit" },
  { value: "consistency", label: "Consistency" },
];

const escalationOptions = [
  { value: "", label: "Any" },
  { value: "true", label: "Escalation suggested" },
  { value: "false", label: "No escalation" },
];

type Filters = {
  severity: string;
  category: string;
  saasSlug: string;
  escalationSuggested: string;
  search: string;
  sort: "priority" | "recent";
  limit: number;
  offset: number;
};

const DEFAULT_FILTERS: Filters = {
  severity: "",
  category: "",
  saasSlug: "",
  escalationSuggested: "",
  search: "",
  sort: "priority",
  limit: 20,
  offset: 0,
};

type ApiResponse = {
  ok: boolean;
  data: GovernanceAlert[];
  summary: GovernanceAlertSummary;
  meta: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  message?: string;
  code?: string;
};

function toneForSeverity(sev: GovernanceAlert["severity"]): "err" | "warn" | "info" | "ok" {
  if (sev === "CRITICAL" || sev === "ERROR") return "err";
  if (sev === "WARN") return "warn";
  if (sev === "INFO") return "info";
  return "ok";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function GovernanceAlertsView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<GovernanceAlert[]>([]);
  const [summary, setSummary] = useState<GovernanceAlertSummary>({ total: 0, critical: 0, degraded: 0, warnings: 0, escalationSuggested: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GovernanceAlert | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.category) params.set("category", filters.category);
    if (filters.saasSlug) params.set("saasSlug", filters.saasSlug);
    if (filters.escalationSuggested) params.set("escalationSuggested", filters.escalationSuggested);
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
    next.severity = searchParams.get("severity") ?? "";
    next.category = searchParams.get("category") ?? "";
    next.saasSlug = searchParams.get("saasSlug") ?? "";
    next.escalationSuggested = searchParams.get("escalationSuggested") ?? "";
    next.search = searchParams.get("search") ?? "";
    next.sort = (searchParams.get("sort") as Filters["sort"]) ?? "priority";
    next.limit = Number(searchParams.get("limit") ?? DEFAULT_FILTERS.limit);
    next.offset = Number(searchParams.get("offset") ?? DEFAULT_FILTERS.offset);
    setFilters(next);
  }, [searchParams]);

  const syncUrl = useCallback(
    (qs: string) => {
      const base = qs ? `?${qs}` : "";
      router.replace(base);
    },
    [router],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/owner/governance/alerts?${queryString}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) {
        throw new Error(json.message || json.code || "Failed to load alerts");
      }
      setRows(json.data);
      setSummary(json.summary);
      // keep selection in sync
      if (selected) {
        const refreshed = json.data.find((a) => a.id === selected.id);
        setSelected(refreshed ?? null);
      }
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

  const hasData = rows.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-5">
        <Card tone="glass" className="p-4">
          <div className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em]">Total alerts</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{summary.total}</div>
        </Card>
        <Card tone="glass" className="p-4">
          <div className="text-[10px] font-bold uppercase text-red-700 tracking-[0.2em]">Critical</div>
          <div className="mt-1 text-2xl font-black text-red-800">{summary.critical}</div>
        </Card>
        <Card tone="glass" className="p-4">
          <div className="text-[10px] font-bold uppercase text-amber-700 tracking-[0.2em]">Degraded</div>
          <div className="mt-1 text-2xl font-black text-amber-800">{summary.degraded}</div>
        </Card>
        <Card tone="glass" className="p-4">
          <div className="text-[10px] font-bold uppercase text-amber-600 tracking-[0.2em]">Warnings</div>
          <div className="mt-1 text-2xl font-black text-amber-700">{summary.warnings}</div>
        </Card>
        <Card tone="glass" className="p-4">
          <div className="text-[10px] font-bold uppercase text-slate-600 tracking-[0.2em]">Escalation suggested</div>
          <div className="mt-1 text-2xl font-black text-slate-800">{summary.escalationSuggested}</div>
        </Card>
      </div>

      <Card tone="glass" className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Severity">
            <Select value={filters.severity} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateFilter("severity", e.target.value)}>
              {severityOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={filters.category} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateFilter("category", e.target.value)}>
              {categoryOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Escalation">
            <Select value={filters.escalationSuggested} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateFilter("escalationSuggested", e.target.value)}>
              {escalationOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="SaaS">
            <TextInput value={filters.saasSlug} onChange={(e) => updateFilter("saasSlug", e.target.value)} placeholder="slug" />
          </Field>
          <div className="flex-1 min-w-[200px]">
            <Field label="Search">
              <TextInput value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Search alerts" />
            </Field>
          </div>
          <Field label="Sort">
            <Select value={filters.sort} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateFilter("sort", (e.target.value as "priority" | "recent") ?? "priority")}>
              <option value="priority">Priority</option>
              <option value="recent">Recent</option>
            </Select>
          </Field>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}> {loading ? "Loading..." : "Refresh"} </Button>
          <Button variant="ghost" size="sm" onClick={resetFilters}>Reset</Button>
        </div>
      </Card>

      <Card tone="glass" className="p-0">
        {loading && (
          <div className="flex items-center gap-3 p-6 text-sm text-slate-600">
            <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" /> Loading alerts...
          </div>
        )}
        {error && <div className="p-6 text-sm text-red-600 border-b border-red-100 bg-red-50">{error}</div>}
        {!loading && !hasData && !error && <EmptyState title="No alerts" subtitle="Adjust filters or refresh." />}

        {hasData && (
          <div className="grid md:grid-cols-[2fr_1fr] gap-0">
            <div className="border-r border-[var(--border)]/70">
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH className="px-4 py-3 text-left">Severity</TH>
                      <TH className="px-4 py-3 text-left">Category</TH>
                      <TH className="px-4 py-3 text-left">SaaS</TH>
                      <TH className="px-4 py-3 text-left">Instance</TH>
                      <TH className="px-4 py-3 text-left">Domain</TH>
                      <TH className="px-4 py-3 text-left">Title</TH>
                      <TH className="px-4 py-3 text-left">Top issue</TH>
                      <TH className="px-4 py-3 text-left">Escalation</TH>
                      <TH className="px-4 py-3 text-left">Last activity</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer hover:bg-[var(--panel)]/60"
                        onClick={() => setSelected(row)}
                        data-testid={`alert-${row.id}`}
                      >
                        <TD className="px-4 py-3">
                          <Badge variant={toneForSeverity(row.severity)} className="font-semibold">{row.severity}</Badge>
                        </TD>
                        <TD className="px-4 py-3"><Badge variant="outline">{row.category}</Badge></TD>
                        <TD className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{row.saasSlug}</div>
                          <div className="text-xs text-slate-500 font-mono" title={row.saasId ?? undefined}>{row.saasId ?? "—"}</div>
                        </TD>
                        <TD className="px-4 py-3 text-xs font-mono text-slate-600" title={row.instanceId ?? undefined}>{row.instanceId ?? "—"}</TD>
                        <TD className="px-4 py-3 text-xs font-mono text-slate-600" title={row.domainId ?? undefined}>{row.domainId ?? "—"}</TD>
                        <TD className="px-4 py-3 text-sm text-slate-900">{row.title}</TD>
                        <TD className="px-4 py-3 text-xs text-slate-600">{row.topIssue ?? "—"}</TD>
                        <TD className="px-4 py-3 text-xs text-slate-700">{row.escalationSuggested ? "Yes" : "No"}</TD>
                        <TD className="px-4 py-3 text-xs font-mono text-slate-600">{formatDate(row.lastEventAt ?? row.createdAt)}</TD>
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
                <div className="text-sm text-slate-500">Select an alert to inspect details.</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-mono text-slate-500">{selected.saasSlug}</div>
                      <div className="text-lg font-black text-slate-900">{selected.title}</div>
                    </div>
                    <Badge className="font-semibold" variant={toneForSeverity(selected.severity)}>{selected.severity}</Badge>
                  </div>
                  <div className="text-xs text-slate-600">Category: {selected.category}</div>
                  <div className="text-sm text-slate-700">{selected.description}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>SaaS ID: <span className="font-mono" title={selected.saasId ?? undefined}>{selected.saasId ?? "—"}</span></div>
                    <div>Instance: <span className="font-mono" title={selected.instanceId ?? undefined}>{selected.instanceId ?? "—"}</span></div>
                    <div>Domain: <span className="font-mono" title={selected.domainId ?? undefined}>{selected.domainId ?? "—"}</span></div>
                    <div>Escalation: {selected.escalationSuggested ? "Suggested" : "Not suggested"}</div>
                    {selected.escalationReason && <div className="col-span-2">Reason: {selected.escalationReason}</div>}
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase text-slate-500">Recommendations</div>
                    <ul className="mt-1 list-disc list-inside text-xs text-slate-700">
                      {(selected.recommendations.length ? selected.recommendations : ["None"]).map((r, idx) => (
                        <li key={`rec-${idx}`}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase text-slate-500">Related actions</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {selected.relatedActions.length ? selected.relatedActions.map((act) => (
                        <Badge key={act} variant="outline">{act}</Badge>
                      )) : <span className="text-slate-500">None</span>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold uppercase text-slate-500">Diagnostic summary</div>
                      <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(selected.diagnosticSummary)}>Copy</Button>
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                      {selected.diagnosticSummary}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <Button variant="outline" size="sm" onClick={() => window.open(`/owner/governance?saasSlug=${selected.saasSlug}`, "_blank")}>Open governance</Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(`/owner/projects/${selected.saasSlug}`, "_blank")}>SaaS</Button>
                    {selected.domainId && (
                      <Button variant="outline" size="sm" onClick={() => window.open(`/owner/domains/${selected.domainId}`, "_blank")}>Domain</Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => window.open(`/owner/factory/jobs?saas=${selected.saasSlug}`, "_blank")}>Provisioning</Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(`/owner/billing?saas=${selected.saasSlug}`, "_blank")}>Billing</Button>
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
