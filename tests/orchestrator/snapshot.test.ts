import { describe, it, expect } from "vitest";
import { buildCampamentoBaseSnapshot } from "@/lib/campamento-base/orchestrator/snapshot";

function makeResp(data: any): Response {
  return { json: async () => data } as any as Response;
}

function createFetch(routes: Record<string, any> | ((path: string) => any), fail: Record<string, boolean> = {}) {
  return async (input: any) => {
    const path = typeof input === "string" ? input : input?.toString?.() ?? "";
    if (fail[path]) throw new Error("fail");
    const data = typeof routes === "function" ? routes(path) : routes[path];
    return makeResp(data ?? {});
  };
}

describe("orchestrator/snapshot", () => {
  it("construcción correcta con datos completos", async () => {
    const base = new Date("2026-04-10T00:00:00Z");
    const history = Array.from({ length: 31 }).map((_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const day = d.toISOString().slice(0, 10);
      const mrr = i === 0 ? 3200 : i === 30 ? 3000 : 3100;
      return { day, mrr };
    });
    const fetchLike = createFetch({
      "/api/operator/revenue": {
        global: { mrr: 3000, activeSaas: 3, activeSubscriptions: 60 },
        bySaas: [
          { saasId: "s1", saasName: "SaaS Uno", mrr: 1000, activeSubscriptions: 20 },
          { saasId: "s2", saasName: "SaaS Dos", mrr: 1200, activeSubscriptions: 25 },
          { saasId: "s3", saasName: "SaaS Tres", mrr: 800, activeSubscriptions: 15 },
        ],
        history,
      },
      "/api/operator/accounting": {
        snapshot: {
          totalSaas: 3,
          totalSubscriptionMRR: 3000,
          vendorFixedMonthly: 500,
          rows: [
            { saasId: "s1", saasName: "SaaS Uno", slug: "s1slug", subscriptionMonthlyAmount: 1000, profitabilityMarginPercent: 0.4, planLabel: "Pro" },
            { saasId: "s2", saasName: "SaaS Dos", slug: "s2slug", subscriptionMonthlyAmount: 1200, profitabilityMarginPercent: 0.3, planLabel: "Pro" },
            { saasId: "s3", saasName: "SaaS Tres", slug: "s3slug", subscriptionMonthlyAmount: 800, planLabel: "Basic" },
          ],
        },
      },
      "/api/operator/events": {
        criticalEvents: [
          { type: "OUTAGE", severity: "CRITICAL", message: "Fallo critico", createdAt: "2026-04-10T00:00:00Z", correlationId: "evt-1", saasSlug: "s2slug" },
        ],
        rollups: [
          { day: "2026-04-10", saasSlug: null, type: "any", severity: "INFO", count: 5, firstSeenAt: "", lastSeenAt: "" },
          { day: "2026-04-09", saasSlug: null, type: "any", severity: "INFO", count: 3, firstSeenAt: "", lastSeenAt: "" },
        ],
      },
      "/api/operator/socialflow": {
        status: [
          { saasId: "s1", slug: "s1slug", enabled: true },
          { saasId: "s2", slug: "s2slug", enabled: false },
          { saasId: "s3", slug: "s3slug", enabled: true },
        ],
      },
      "/api/operator/governance": {
        rows: [
          { saasId: "s1", slug: "s1slug", severity: "OK" },
          { saasId: "s2", slug: "s2slug", severity: "CRITICAL" },
          { saasId: "s3", slug: "s3slug", severity: "WARNING" },
        ],
      },
    });

    const snap = await buildCampamentoBaseSnapshot({ fetchLike });
    expect(snap.kpis.totalMRR).toBe(3000);
    expect(snap.kpis.approxMarginMonthly).toBe(2500);
    expect(snap.saas.length).toBe(3);
    const s1 = snap.saas.find((s) => s.saasId === "s1")!;
    const s2 = snap.saas.find((s) => s.saasId === "s2")!;
    const s3 = snap.saas.find((s) => s.saasId === "s3")!;
    expect(s1.cost).toBe(600);
    expect(s1.marginEur).toBe(400);
    expect(s2.opsSeverity).toBe("CRITICAL");
    expect(s3.opsSeverity).toBe("WARNING");
    expect(snap.socialflow?.total).toBe(3);
    expect(snap.socialflow?.enabled).toBe(2);
    expect(snap.events.growth7d.current).toBe(8);
    expect(snap.events.growth30d.current).toBe(8);
    expect(snap.mrr30d?.current).toBe(3200);
    expect(snap.mrr30d?.previous).toBe(3000);
  });

  it("fallback si governance falla", async () => {
    const fetchLike = createFetch(
      {
        "/api/operator/revenue": { global: { mrr: 1000, activeSaas: 2 }, bySaas: [{ saasId: "s1", mrr: 500 }, { saasId: "s2", mrr: 500 }] },
        "/api/operator/accounting": { snapshot: { totalSaas: 2, totalSubscriptionMRR: 1000, vendorFixedMonthly: 0, rows: [
          { saasId: "s1", saasName: "S1", slug: "s1slug", subscriptionMonthlyAmount: 500, profitabilityMarginPercent: 0.5 },
          { saasId: "s2", saasName: "S2", slug: "s2slug", subscriptionMonthlyAmount: 500, profitabilityMarginPercent: 0.5 },
        ] } },
        "/api/operator/events": { criticalEvents: [ { type: "OUTAGE", severity: "CRITICAL", message: "", createdAt: "2026-04-10T00:00:00Z", correlationId: "e1", saasSlug: "s2slug" } ], rollups: [] },
        "/api/operator/socialflow": { status: [] },
      },
      { "/api/operator/governance": true }
    );

    const snap = await buildCampamentoBaseSnapshot({ fetchLike });
    expect(snap.governance).toBeNull();
    const s2 = snap.saas.find((s) => s.saasId === "s2")!;
    expect(s2.opsSeverity).toBe("CRITICAL");
  });

  it("fallback si no hay serie MRR 30d", async () => {
    const fetchLike = createFetch({
      "/api/operator/revenue": { global: { mrr: 1000, activeSaas: 1 }, bySaas: [{ saasId: "s1", mrr: 1000 }], history: [ { day: "2026-04-10", mrr: 1000 } ] },
      "/api/operator/accounting": { snapshot: { totalSaas: 1, totalSubscriptionMRR: 1000, vendorFixedMonthly: 0, rows: [ { saasId: "s1", saasName: "S1", slug: "s1slug", subscriptionMonthlyAmount: 1000, profitabilityMarginPercent: 0.5 } ] } },
      "/api/operator/events": { criticalEvents: [], rollups: [] },
      "/api/operator/socialflow": { status: [] },
      "/api/operator/governance": { rows: [] },
    });
    const snap = await buildCampamentoBaseSnapshot({ fetchLike });
    expect(snap.mrr30d).toBeNull();
  });

  it("fallback de severidad por eventos", async () => {
    const fetchLike = createFetch({
      "/api/operator/revenue": { global: { mrr: 1000, activeSaas: 1 }, bySaas: [{ saasId: "s1", mrr: 1000 }] },
      "/api/operator/accounting": { snapshot: { totalSaas: 1, totalSubscriptionMRR: 1000, vendorFixedMonthly: 0, rows: [ { saasId: "s1", saasName: "S1", slug: "s1slug", subscriptionMonthlyAmount: 1000, profitabilityMarginPercent: 0.5 } ] } },
      "/api/operator/events": { criticalEvents: [], rollups: [ { day: "2026-04-10", saasSlug: "s1slug", type: "x", severity: "WARNING", count: 5, firstSeenAt: "", lastSeenAt: "" } ] },
      "/api/operator/socialflow": { status: [] },
      "/api/operator/governance": { rows: [] },
    });
    const snap = await buildCampamentoBaseSnapshot({ fetchLike });
    const s1 = snap.saas.find((s) => s.saasId === "s1")!;
    expect(s1.opsSeverity).toBe("WARNING");
  });

  it("snapshot estable sin mutaciones", async () => {
    const routes = {
      "/api/operator/revenue": { global: { mrr: 1000, activeSaas: 1 }, bySaas: [{ saasId: "s1", mrr: 1000 }], history: [ { day: "2026-04-10", mrr: 1000 }, { day: "2026-04-09", mrr: 990 } ] },
      "/api/operator/accounting": { snapshot: { totalSaas: 1, totalSubscriptionMRR: 1000, vendorFixedMonthly: 0, rows: [ { saasId: "s1", saasName: "S1", slug: "s1slug", subscriptionMonthlyAmount: 1000, profitabilityMarginPercent: 0.5 } ] } },
      "/api/operator/events": { criticalEvents: [], rollups: [] },
      "/api/operator/socialflow": { status: [ { saasId: "s1", enabled: true } ] },
      "/api/operator/governance": { rows: [ { saasId: "s1", severity: "OK" } ] },
    };
    const fetchLike = createFetch(routes);
    const a = await buildCampamentoBaseSnapshot({ fetchLike });
    const b = await buildCampamentoBaseSnapshot({ fetchLike });
    expect(a).toEqual(b);
  });
});
