import { CampamentoBaseSnapshot, CriticalEvent, EventRollup, GovernanceSummary, Growth, Growth30WithSeries, MrrTrend30d, SaasRow, SnapshotKpis, SocialflowSummary } from "./types";

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type BuildSnapshotOptions = {
  fetchLike?: FetchLike;
  origin?: string;
};

async function safeJson<T = any>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function computeKpis(revenue: any | null, accounting: any | null): SnapshotKpis {
  const totalMRR = Number(accounting?.totalSubscriptionMRR ?? revenue?.global?.mrr ?? 0);
  const totalSaas = Number(accounting?.totalSaas ?? revenue?.global?.activeSaas ?? 0);
  const vendorFixed = Number(accounting?.vendorFixedMonthly ?? 0);
  const approxMarginMonthly = Math.max(0, totalMRR - vendorFixed);
  const approxMarginRate = totalMRR > 0 ? approxMarginMonthly / totalMRR : 0;
  const activeSubscriptions = typeof revenue?.global?.activeSubscriptions === "number" ? revenue.global.activeSubscriptions : undefined;
  return { totalMRR, totalSaas, vendorFixedMonthly: vendorFixed, approxMarginMonthly, approxMarginRate, activeSubscriptions };
}

function normalizeEvents(data: any | null): { criticalEvents: CriticalEvent[]; rollups: EventRollup[] } {
  const criticalEvents: CriticalEvent[] = Array.isArray(data?.criticalEvents)
    ? data.criticalEvents.map((e: any) => ({
        type: String(e.type),
        severity: String(e.severity),
        message: String(e.message ?? ""),
        createdAt: String(e.created_at ?? e.createdAt ?? new Date().toISOString()),
        correlationId: String(e.correlation_id ?? e.correlationId ?? ""),
        saasSlug: e.saas_slug ?? e.saasSlug ?? null,
      }))
    : [];
  const rollups: EventRollup[] = Array.isArray(data?.rollups)
    ? data.rollups.map((r: any) => ({
        day: String(r.day),
        saasSlug: r.saas_slug ?? r.saasSlug ?? null,
        type: String(r.type),
        severity: String(r.severity),
        count: Number(r.count ?? 0),
        firstSeenAt: String(r.first_seen_at ?? r.firstSeenAt ?? ""),
        lastSeenAt: String(r.last_seen_at ?? r.lastSeenAt ?? ""),
      }))
    : [];
  return { criticalEvents, rollups };
}

function computeGrowth(fromRollups: EventRollup[], window: number): Growth {
  const byDay: Record<string, number> = {};
  for (const r of fromRollups) byDay[r.day] = (byDay[r.day] ?? 0) + r.count;
  const days = Object.keys(byDay).sort((a, b) => (a < b ? 1 : -1));
  const lastN = days.slice(0, window);
  const prevN = days.slice(window, window * 2);
  const sum = (arr: string[]) => arr.reduce((acc, d) => acc + (byDay[d] ?? 0), 0);
  const current = sum(lastN);
  const previous = sum(prevN);
  const delta = current - previous;
  const rate = previous > 0 ? delta / previous : current > 0 ? 1 : 0;
  return { current, previous, delta, rate };
}

function computeGrowth30WithSeries(fromRollups: EventRollup[]): Growth30WithSeries {
  const base = computeGrowth(fromRollups, 30);
  const byDay: Record<string, number> = {};
  for (const r of fromRollups) byDay[r.day] = (byDay[r.day] ?? 0) + r.count;
  const days = Object.keys(byDay).sort((a, b) => (a < b ? 1 : -1));
  const last30 = days.slice(0, 30);
  return { ...base, series: last30.map((d) => ({ day: d, total: byDay[d] ?? 0 })) };
}

function computeMrr30d(revenue: any | null): MrrTrend30d | null {
  const hist = Array.isArray(revenue?.history)
    ? (revenue.history as Array<{ day: string; mrr: number }>).slice().sort((a, b) => (a.day < b.day ? 1 : -1))
    : [];
  if (hist.length < 2) return null;
  const current = hist[0]?.mrr ?? 0;
  const pastIndex = 30;
  const pastCandidate = hist[pastIndex]?.mrr;
  const past = typeof pastCandidate === "number" ? pastCandidate : hist.at(-1)?.mrr;
  if (typeof past !== "number") return { current };
  const delta = current - past;
  const rate = past > 0 ? delta / past : current > 0 ? 1 : 0;
  return { current, previous: past, delta, rate };
}

function deriveOpsFromEvents(rollups: EventRollup[], criticalEvents: CriticalEvent[]): Record<string, "CRITICAL" | "WARNING"> {
  const map: Record<string, "CRITICAL" | "WARNING"> = {};
  const criticalBySlug = new Set<string>();
  const warningBySlug = new Set<string>();
  for (const e of criticalEvents) {
    const slug = (e.saasSlug ?? "").toString();
    if (!slug) continue;
    const sev = (e.severity ?? "").toUpperCase();
    if (sev.includes("CRITICAL")) criticalBySlug.add(slug);
    else if (sev.includes("WARN")) warningBySlug.add(slug);
  }
  for (const r of rollups) {
    const slug = (r.saasSlug ?? "").toString();
    if (!slug) continue;
    const sev = (r.severity ?? "").toUpperCase();
    if (sev.includes("CRITICAL") && r.count > 0) criticalBySlug.add(slug);
    else if (sev.includes("WARN") && r.count > 0) warningBySlug.add(slug);
  }
  const all = new Set<string>([...criticalBySlug, ...warningBySlug]);
  for (const slug of all) map[slug] = criticalBySlug.has(slug) ? "CRITICAL" : "WARNING";
  return map;
}

export async function buildCampamentoBaseSnapshot(arg?: FetchLike | BuildSnapshotOptions): Promise<CampamentoBaseSnapshot> {
  const opts: BuildSnapshotOptions = typeof arg === "function" || arg instanceof Function ? { fetchLike: arg as FetchLike } : (arg ?? {});
  const f: FetchLike = opts.fetchLike ?? fetch;
  const p = (path: string) => (opts.origin ? new URL(path, opts.origin).toString() : path);
  const [revRes, accRes, evtRes, socRes, govRes] = await Promise.allSettled([
    f(p("/api/operator/revenue"), { cache: "no-store" }),
    f(p("/api/operator/accounting"), { cache: "no-store" }),
    f(p("/api/operator/events"), { cache: "no-store" }),
    f(p("/api/operator/socialflow"), { cache: "no-store" }),
    f(p("/api/operator/governance"), { cache: "no-store" }),
  ]);

  const revenue = revRes.status === "fulfilled" ? await safeJson<any>(revRes.value) : null;
  const accountingResp = accRes.status === "fulfilled" ? await safeJson<any>(accRes.value) : null;
  const accounting = accountingResp?.snapshot ?? null;
  const eventsResp = evtRes.status === "fulfilled" ? await safeJson<any>(evtRes.value) : null;
  const socialflow = socRes.status === "fulfilled" ? (await safeJson<any>(socRes.value)) : null;
  const governanceResp = govRes.status === "fulfilled" ? await safeJson<any>(govRes.value) : null;

  const { criticalEvents, rollups } = normalizeEvents(eventsResp);

  const kpis = computeKpis(revenue, accounting);

  const bySaasMrr = new Map<string, number>();
  const bySaasSubs = new Map<string, number>();
  for (const r of Array.isArray(revenue?.bySaas) ? revenue.bySaas : []) {
    if (!r?.saasId) continue;
    bySaasMrr.set(String(r.saasId), Number(r.mrr ?? 0));
    if (typeof r.activeSubscriptions === "number") bySaasSubs.set(String(r.saasId), Number(r.activeSubscriptions));
  }

  const governanceRows: any[] = Array.isArray(governanceResp?.rows)
    ? governanceResp.rows
    : Array.isArray(governanceResp?.items)
    ? governanceResp.items
    : Array.isArray(governanceResp)
    ? governanceResp
    : [];
  let gCritical = 0, gWarning = 0, gOk = 0;
  const gmap: Record<string, { severity: "CRITICAL" | "WARNING" | "OK" | "UNKNOWN" }> = {};
  for (const r of governanceRows) {
    const sevRaw = String(r?.severity ?? r?.healthSeverity ?? r?.status ?? "").toUpperCase();
    const sev = sevRaw.includes("CRITICAL") ? "CRITICAL" : sevRaw.includes("WARN") ? "WARNING" : sevRaw.includes("OK") ? "OK" : "UNKNOWN";
    if (sev === "CRITICAL") gCritical++; else if (sev === "WARNING") gWarning++; else if (sev === "OK") gOk++;
    const id = r?.saasId ?? r?.saas_id ?? r?.id ?? r?.projectId ?? null;
    const slug = r?.slug ?? r?.saasSlug ?? null;
    if (id != null) gmap[String(id)] = { severity: sev };
    if (slug != null) gmap[`slug:${String(slug)}`] = { severity: sev };
  }

  const opsFromEvents = deriveOpsFromEvents(rollups, criticalEvents);

  const saasRows: SaasRow[] = (Array.isArray(accounting?.rows) ? accounting.rows : []).map((row: any) => {
    const mrr = Number(row.subscriptionMonthlyAmount ?? bySaasMrr.get(String(row.saasId)) ?? 0);
    const marginPct = typeof row.profitabilityMarginPercent === "number" ? row.profitabilityMarginPercent : undefined;
    const cost = typeof marginPct === "number" ? Math.max(0, mrr * (1 - marginPct)) : undefined;
    const marginEur = typeof marginPct === "number" ? Math.max(0, mrr * marginPct) : undefined;
    let ops = gmap[String(row.saasId)]?.severity ?? (row.slug ? gmap[`slug:${row.slug}`]?.severity : undefined);
    if (!ops) {
      const viaEvents = row.slug ? opsFromEvents[String(row.slug)] : undefined;
      ops = (viaEvents ?? "OK") as typeof ops;
    }
    if (!ops) ops = "OK";

    let socialEnabled: boolean | undefined = undefined;
    const sdata = socialflow as any;
    if (sdata) {
      const smap: Record<string, { enabled?: boolean }> = {};
      if (Array.isArray(sdata?.status)) {
        for (const x of sdata.status as any[]) {
          const id = x?.saasId ?? x?.saas_id ?? x?.id ?? x?.projectId ?? null;
          const slug = x?.slug ?? x?.saasSlug ?? null;
          if (id != null) smap[String(id)] = { enabled: Boolean(x?.enabled) };
          if (slug != null) smap[`slug:${String(slug)}`] = { enabled: Boolean(x?.enabled) };
        }
      }
      if (!Array.isArray(sdata?.status) && Array.isArray(sdata?.items)) {
        for (const x of sdata.items as any[]) {
          const id = x?.saasId ?? x?.saas_id ?? x?.id ?? x?.projectId ?? null;
          const slug = x?.slug ?? x?.saasSlug ?? null;
          if (id != null) smap[String(id)] = { enabled: Boolean(x?.enabled) };
          if (slug != null) smap[`slug:${String(slug)}`] = { enabled: Boolean(x?.enabled) };
        }
      }
      socialEnabled = smap[String(row.saasId)]?.enabled ?? (row.slug ? smap[`slug:${row.slug}`]?.enabled : undefined);
    }

    return {
      saasId: String(row.saasId),
      saasName: String(row.saasName ?? row.saasId),
      slug: row.slug ? String(row.slug) : undefined,
      planLabel: row.planLabel ?? undefined,
      mrr,
      marginPct,
      cost,
      marginEur,
      activeSubs: bySaasSubs.get(String(row.saasId)),
      opsSeverity: ops,
      socialEnabled,
    } as SaasRow;
  }).sort((a: SaasRow, b: SaasRow) => b.mrr - a.mrr);

  const growth7d: Growth = computeGrowth(rollups, 7);
  const growth30d: Growth30WithSeries = computeGrowth30WithSeries(rollups);
  const mrr30d: MrrTrend30d | null = computeMrr30d(revenue);

  const socialSummary: SocialflowSummary | null = (() => {
    const data: any = socialflow;
    if (!data) return null;
    const s: SocialflowSummary = { total: undefined, enabled: undefined, disabled: undefined, lastRunAt: null };
    if (data?.summary && typeof data.summary === "object") {
      s.total = Number(data.summary.total ?? data.summary.totalSaas ?? data.summary.count ?? 0);
      s.enabled = Number(data.summary.enabled ?? 0);
      s.disabled = Number(
        data.summary.disabled ?? (typeof s.total === "number" && typeof s.enabled === "number" ? Math.max(0, s.total - s.enabled) : 0),
      );
      s.lastRunAt = (data.summary.lastRunAt as string | undefined) ?? null;
    }
    if (Array.isArray(data?.status)) {
      const total = data.status.length;
      const enabled = data.status.filter((x: any) => Boolean(x?.enabled)).length;
      s.total = total;
      s.enabled = enabled;
      s.disabled = Math.max(0, total - enabled);
      s.lastRunAt = null;
    }
    return s;
  })();

  const governanceSummary: GovernanceSummary | null = governanceRows.length
    ? { total: governanceRows.length, critical: gCritical, warning: gWarning, ok: gOk }
    : null;

  return {
    kpis,
    saas: saasRows,
    socialflow: socialSummary,
    governance: governanceSummary,
    events: { criticalEvents, rollups, growth7d, growth30d },
    mrr30d,
  };
}
