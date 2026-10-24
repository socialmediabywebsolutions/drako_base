"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";
import OperatorGovernanceView from "./OperatorGovernanceView";
import GovernanceAlertsView from "./GovernanceAlertsView";

import type { GovernanceSummary, GovernanceRow } from "@/lib/ops/operator-governance-view";
import type { GovernanceAlert, GovernanceAlertSummary } from "@/lib/ops/governance-alerts";
import { buildExecutiveSnapshot, buildExecutiveDelta, buildExecutiveSummary, type GovernanceExecutiveSnapshot } from "@/lib/ops/governance-executive";

import { useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "governance", label: "Governance" },
  { id: "alerts", label: "Alerts" },
  { id: "executive", label: "Executive" },
] as const;

function useTab(): [string, (tab: string) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params?.get("tab") ?? "overview";
  const setTab = useCallback(
    (next: string) => {
      const qp = new URLSearchParams(params ?? undefined);
      if (next === "overview") qp.delete("tab");
      else qp.set("tab", next);
      const qs = qp.toString();
      router.replace(qs ? `?${qs}` : "");
    },
    [params, router],
  );
  return [tab, setTab];
}

type GovApiResponse = {
  ok: boolean;
  data: GovernanceRow[];
  summary: GovernanceSummary;
  message?: string;
  code?: string;
};

type AlertApiResponse = {
  ok: boolean;
  data: GovernanceAlert[];
  summary: GovernanceAlertSummary;
  message?: string;
  code?: string;
};

export default function GovernanceControlPlane() {
  const [tab, setTab] = useTab();
  const [govSummary, setGovSummary] = useState<GovernanceSummary | null>(null);
  const [alertsSummary, setAlertsSummary] = useState<GovernanceAlertSummary | null>(null);
  const [topRows, setTopRows] = useState<GovernanceRow[]>([]);
  const [topAlerts, setTopAlerts] = useState<GovernanceAlert[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [execSnapshot, setExecSnapshot] = useState<GovernanceExecutiveSnapshot | null>(null);
  const [prevSnapshot, setPrevSnapshot] = useState<GovernanceExecutiveSnapshot | null>(null);
  const [prevSnapshotText, setPrevSnapshotText] = useState("");
  const [execError, setExecError] = useState<string | null>(null);

  const needsAttention = useMemo(() => {
    const criticalRows = topRows.filter((r) => ["BLOCKED", "DEGRADED"].includes(r.overallGovernanceStatus));
    const criticalAlerts = topAlerts.filter((a) => ["CRITICAL", "ERROR"].includes(a.severity));
    return [...criticalRows.map((r) => ({ type: "row" as const, key: r.saasSlug, severity: r.severity, status: r.overallGovernanceStatus, title: r.saasName ?? r.saasSlug, issue: r.topIssue ?? r.blockers[0] ?? r.warnings[0] ?? "" })), ...criticalAlerts.map((a) => ({ type: "alert" as const, key: a.id, severity: a.severity, status: a.category, title: a.title, issue: a.topIssue ?? a.description }))];
  }, [topRows, topAlerts]);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const [govRes, alertRes] = await Promise.all([
        fetch(`/api/operator/governance?limit=5&sort=priority`, { cache: "no-store" }).then((r) => r.json() as Promise<GovApiResponse>),
        fetch(`/api/operator/governance/alerts?limit=5&sort=priority`, { cache: "no-store" }).then((r) => r.json() as Promise<AlertApiResponse>),
      ]);
      if (!govRes.ok) throw new Error(govRes.message || govRes.code || "Failed to load governance overview");
      if (!alertRes.ok) throw new Error(alertRes.message || alertRes.code || "Failed to load alerts overview");
      setGovSummary(govRes.summary);
      setAlertsSummary(alertRes.summary);
      setTopRows(govRes.data ?? []);
      setTopAlerts(alertRes.data ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setOverviewError(msg);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadExecutive = useCallback(async () => {
    setExecError(null);
    try {
      const [govRes, alertRes] = await Promise.all([
        fetch(`/api/operator/governance?limit=20&sort=priority`, { cache: "no-store" }).then((r) => r.json() as Promise<GovApiResponse>),
        fetch(`/api/operator/governance/alerts?limit=20&sort=priority`, { cache: "no-store" }).then((r) => r.json() as Promise<AlertApiResponse>),
      ]);
      if (!govRes.ok) throw new Error(govRes.message || govRes.code || "Failed to load governance snapshot");
      if (!alertRes.ok) throw new Error(alertRes.message || alertRes.code || "Failed to load alerts snapshot");
      const snapshot = buildExecutiveSnapshot({
        governanceSummary: govRes.summary,
        alertsSummary: alertRes.summary,
        rows: govRes.data,
        alerts: alertRes.data,
      });
      setExecSnapshot(snapshot);
      // reuse summaries for cards
      setGovSummary((prev) => prev ?? govRes.summary);
      setAlertsSummary((prev) => prev ?? alertRes.summary);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setExecError(msg);
    }
  }, []);

  useEffect(() => {
    if (tab === "overview") void loadOverview();
    if (tab === "executive") void loadExecutive();
  }, [tab, loadOverview, loadExecutive]);

  const renderOverview = () => {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-5">
          <Card tone="glass" className="p-4">
            <div className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em]">Governance total</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{govSummary?.total ?? "—"}</div>
          </Card>
          <Card tone="glass" className="p-4">
            <div className="text-[10px] font-bold uppercase text-emerald-700 tracking-[0.2em]">Healthy</div>
            <div className="mt-1 text-2xl font-black text-emerald-800">{govSummary?.healthy ?? "—"}</div>
          </Card>
          <Card tone="glass" className="p-4">
            <div className="text-[10px] font-bold uppercase text-amber-700 tracking-[0.2em]">Warnings</div>
            <div className="mt-1 text-2xl font-black text-amber-800">{govSummary?.warnings ?? "—"}</div>
          </Card>
          <Card tone="glass" className="p-4">
            <div className="text-[10px] font-bold uppercase text-red-700 tracking-[0.2em]">Degraded</div>
            <div className="mt-1 text-2xl font-black text-red-800">{govSummary?.degraded ?? "—"}</div>
          </Card>
          <Card tone="glass" className="p-4">
            <div className="text-[10px] font-bold uppercase text-red-900 tracking-[0.2em]">Blocked</div>
            <div className="mt-1 text-2xl font-black text-red-900">{govSummary?.blocked ?? "—"}</div>
          </Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-5">
          <Card tone="glass" className="p-4">
            <div className="text-[10px] font-bold uppercase text-slate-600 tracking-[0.2em]">Alerts total</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{alertsSummary?.total ?? "—"}</div>
          </Card>
          <Card tone="glass" className="p-4">
            <div className="text-[10px] font-bold uppercase text-red-800 tracking-[0.2em]">Critical</div>
            <div className="mt-1 text-2xl font-black text-red-800">{alertsSummary?.critical ?? "—"}</div>
          </Card>
          <Card tone="glass" className="p-4">
            <div className="text-[10px] font-bold uppercase text-amber-700 tracking-[0.2em]">Degraded</div>
            <div className="mt-1 text-2xl font-black text-amber-800">{alertsSummary?.degraded ?? "—"}</div>
          </Card>
          <Card tone="glass" className="p-4">
            <div className="text-[10px] font-bold uppercase text-amber-600 tracking-[0.2em]">Warnings</div>
            <div className="mt-1 text-2xl font-black text-amber-700">{alertsSummary?.warnings ?? "—"}</div>
          </Card>
          <Card tone="glass" className="p-4">
            <div className="text-[10px] font-bold uppercase text-slate-700 tracking-[0.2em]">Escalation</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{alertsSummary?.escalationSuggested ?? "—"}</div>
          </Card>
        </div>

        <Card tone="glass" className="p-4">
          <div className="text-[11px] font-bold uppercase text-slate-600">Operational buckets</div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="warn">Provisioning risks: {govSummary?.provisioningRunning ?? 0}</Badge>
            <Badge variant="err">Billing issues: {govSummary?.billingIssues ?? 0}</Badge>
            <Badge variant="warn">Domain verifying: {govSummary?.verifyingDomains ?? 0}</Badge>
            <Badge variant="outline">Audit gaps: {govSummary?.auditStale ?? 0}</Badge>
            <Badge variant="warn">Lifecycle mismatches: {govSummary?.lifecycleMismatches ?? 0}</Badge>
            <Badge variant="err">Critical blockers: {govSummary?.criticalBlockers ?? 0}</Badge>
          </div>
        </Card>

        <Card tone="glass" className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-600">Needs attention now</div>
              <p className="text-xs text-slate-500">Blocked/Degraded rows y alerts críticas</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setTab("governance")}>View governance</Button>
              <Button variant="outline" size="sm" onClick={() => setTab("alerts")}>View alerts</Button>
            </div>
          </div>
          {loadingOverview && <div className="text-sm text-slate-600">Loading…</div>}
          {overviewError && <div className="text-sm text-red-600">{overviewError}</div>}
          {!loadingOverview && !overviewError && needsAttention.length === 0 && <EmptyState title="No urgent issues" subtitle="Great, nothing needs immediate attention." />}
          {!loadingOverview && !overviewError && needsAttention.length > 0 && (
            <div className="space-y-2">
              {needsAttention.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border border-[var(--border)]/70 bg-[var(--panel)]/60 px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-600">{item.issue || "Needs inspection"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.severity === "CRITICAL" || item.severity === "ERROR" ? "err" : "warn"}>{item.severity}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (item.type === "row") {
                          window.open(`/operator/governance?saasSlug=${item.key}`, "_blank");
                        } else {
                          window.open(`/operator/governance/alerts?saasSlug=${item.key.split(":")[0] ?? ""}`, "_blank");
                        }
                      }}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-[var(--border)]/70 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition ${tab === t.id ? "bg-[var(--panel)] text-slate-900 shadow" : "text-slate-600 hover:text-slate-900"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && renderOverview()}
      {tab === "governance" && <OperatorGovernanceView />}
      {tab === "alerts" && <GovernanceAlertsView />}
      {tab === "executive" && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-600">Executive reporting</div>
              <p className="text-xs text-slate-500">Snapshot derived from governance + alerts, read-only.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void loadExecutive()}>Refresh snapshot</Button>
              {execSnapshot && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(execSnapshot, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `governance-executive-snapshot.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export snapshot JSON
                </Button>
              )}
              {execSnapshot && (
                <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(buildExecutiveSummary({ snapshot: execSnapshot }))}>
                  Copy executive summary
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Card tone="glass" className="p-4">
              <div className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em]">Blocked</div>
              <div className="mt-1 text-2xl font-black text-red-800">{execSnapshot?.governanceSummary.blocked ?? "—"}</div>
            </Card>
            <Card tone="glass" className="p-4">
              <div className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em]">Degraded</div>
              <div className="mt-1 text-2xl font-black text-red-700">{execSnapshot?.governanceSummary.degraded ?? "—"}</div>
            </Card>
            <Card tone="glass" className="p-4">
              <div className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em]">Critical alerts</div>
              <div className="mt-1 text-2xl font-black text-red-800">{execSnapshot?.alertsSummary.critical ?? "—"}</div>
            </Card>
            <Card tone="glass" className="p-4">
              <div className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em]">Escalation suggested</div>
              <div className="mt-1 text-2xl font-black text-slate-900">{execSnapshot?.alertsSummary.escalationSuggested ?? "—"}</div>
            </Card>
          </div>

          <Card tone="glass" className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase text-slate-600">Executive summary</div>
            </div>
            {execError && <div className="text-sm text-red-600">{execError}</div>}
            {!execSnapshot && !execError && <div className="text-sm text-slate-500">Load snapshot to view executive summary.</div>}
            {execSnapshot && (
              <div className="rounded border border-[var(--border)] bg-[var(--panel)]/60 p-3 text-sm text-slate-800">
                {buildExecutiveSummary({ snapshot: execSnapshot, previous: prevSnapshot ?? undefined, delta: prevSnapshot ? buildExecutiveDelta(execSnapshot, prevSnapshot) : undefined })}
              </div>
            )}
          </Card>

          <Card tone="glass" className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-600">Snapshot delta (current vs previous)</div>
                <p className="text-xs text-slate-500">Paste a previous snapshot JSON to compare.</p>
              </div>
              {prevSnapshot && <Badge variant="outline">Previous loaded</Badge>}
            </div>
            <textarea
              className="w-full rounded border border-[var(--border)] bg-white p-2 text-xs font-mono"
              rows={5}
              value={prevSnapshotText}
              onChange={(e) => setPrevSnapshotText(e.target.value)}
              placeholder="Paste previous snapshot JSON here"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(prevSnapshotText) as GovernanceExecutiveSnapshot;
                    setPrevSnapshot(parsed);
                    setExecError(null);
                  } catch (err) {
                    setExecError("Invalid snapshot JSON");
                  }
                }}
              >
                Load previous snapshot
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setPrevSnapshot(null); setPrevSnapshotText(""); }}>Clear</Button>
            </div>
            {execSnapshot && prevSnapshot && (
              <div className="grid gap-2 sm:grid-cols-4 text-sm">
                {(() => {
                  const delta = buildExecutiveDelta(execSnapshot, prevSnapshot);
                  const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
                  return (
                    <>
                      <Card tone="glass" className="p-3">
                        <div className="text-[10px] uppercase text-slate-500">Blocked</div>
                        <div className="text-lg font-bold text-slate-900">{fmt(delta.blockedDiff)}</div>
                      </Card>
                      <Card tone="glass" className="p-3">
                        <div className="text-[10px] uppercase text-slate-500">Degraded</div>
                        <div className="text-lg font-bold text-slate-900">{fmt(delta.degradedDiff)}</div>
                      </Card>
                      <Card tone="glass" className="p-3">
                        <div className="text-[10px] uppercase text-slate-500">Critical alerts</div>
                        <div className="text-lg font-bold text-slate-900">{fmt(delta.criticalAlertsDiff)}</div>
                      </Card>
                      <Card tone="glass" className="p-3">
                        <div className="text-[10px] uppercase text-slate-500">Escalation</div>
                        <div className="text-lg font-bold text-slate-900">{fmt(delta.escalationSuggestedDiff)}</div>
                      </Card>
                    </>
                  );
                })()}
              </div>
            )}
          </Card>

          <Card tone="glass" className="p-4 space-y-3">
            <div className="text-[11px] font-bold uppercase text-slate-600">Top hotspots</div>
            {execSnapshot ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {execSnapshot.topHotspots.map((h) => (
                  <Badge key={h} variant="warn">{h}</Badge>
                ))}
                {!execSnapshot.topHotspots.length && <span className="text-slate-500">None</span>}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Load snapshot.</div>
            )}
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            <Card tone="glass" className="p-4 space-y-2">
              <div className="text-[11px] font-bold uppercase text-slate-600">Top blocked / degraded rows</div>
              {execSnapshot && execSnapshot.topBlockedRows.length ? (
                <div className="space-y-2">
                  {execSnapshot.topBlockedRows.map((r) => (
                    <div key={r.saasSlug} className="flex items-center justify-between rounded border border-[var(--border)]/70 px-3 py-2">
                      <div>
                        <div className="font-semibold text-slate-900">{r.saasName ?? r.saasSlug}</div>
                        <div className="text-xs text-slate-600">{r.topIssue ?? r.blockers[0] ?? r.warnings[0] ?? "Needs inspection"}</div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Badge variant={r.overallGovernanceStatus === "BLOCKED" ? "err" : "warn"}>{r.overallGovernanceStatus}</Badge>
                        <Button variant="outline" size="sm" onClick={() => window.open(`/operator/governance?saasSlug=${r.saasSlug}`, "_blank")}>Open</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">No blocked/degraded rows.</div>
              )}
            </Card>

            <Card tone="glass" className="p-4 space-y-2">
              <div className="text-[11px] font-bold uppercase text-slate-600">Top critical alerts</div>
              {execSnapshot && execSnapshot.topCriticalAlerts.length ? (
                <div className="space-y-2">
                  {execSnapshot.topCriticalAlerts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded border border-[var(--border)]/70 px-3 py-2">
                      <div>
                        <div className="font-semibold text-slate-900">{a.title}</div>
                        <div className="text-xs text-slate-600">{a.topIssue ?? a.description}</div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Badge variant={"err"}>{a.severity}</Badge>
                        <Button variant="outline" size="sm" onClick={() => window.open(`/operator/governance/alerts?saasSlug=${a.saasSlug}`, "_blank")}>Open</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">No critical alerts.</div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
