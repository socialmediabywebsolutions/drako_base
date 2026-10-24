import { describe, it, expect } from "vitest";
import { answerQuestion } from "@/lib/campamento-base/orchestrator/qa";
import { CampamentoBaseSnapshot } from "@/lib/campamento-base/orchestrator/types";

function makeBaseSnapshot(partial?: Partial<CampamentoBaseSnapshot>): CampamentoBaseSnapshot {
  const base: CampamentoBaseSnapshot = {
    kpis: {
      totalMRR: 3000,
      totalSaas: 3,
      vendorFixedMonthly: 500,
      approxMarginMonthly: 2500,
      approxMarginRate: 2500 / 3000,
      activeSubscriptions: 60,
    },
    saas: [
      {
        saasId: "s1",
        saasName: "SaaS Uno",
        slug: "s1slug",
        planLabel: "Pro",
        mrr: 1000,
        marginPct: 0.4,
        marginEur: 400,
        cost: 600,
        activeSubs: 20,
        opsSeverity: "OK",
        socialEnabled: true,
      },
      {
        saasId: "s2",
        saasName: "SaaS Dos",
        slug: "s2slug",
        planLabel: "Pro",
        mrr: 1200,
        marginPct: 0.3,
        marginEur: 360,
        cost: 840,
        activeSubs: 25,
        opsSeverity: "CRITICAL",
        socialEnabled: false,
      },
      {
        saasId: "s3",
        saasName: "SaaS Tres",
        slug: "s3slug",
        planLabel: "Basic",
        mrr: 800,
        // sin margen para cubrir casos
        activeSubs: 15,
        opsSeverity: "WARNING",
        socialEnabled: true,
      },
    ],
    socialflow: { total: 3, enabled: 2, disabled: 1, lastRunAt: null },
    governance: { total: 3, critical: 1, warning: 1, ok: 1 },
    events: {
      criticalEvents: [
        {
          type: "OUTAGE",
          severity: "CRITICAL",
          message: "Fallo critico",
          createdAt: new Date().toISOString(),
          correlationId: "evt-1",
          saasSlug: "s2slug",
        },
      ],
      rollups: [
        { day: "2026-04-10", saasSlug: null, type: "any", severity: "INFO", count: 5, firstSeenAt: "", lastSeenAt: "" },
        { day: "2026-04-09", saasSlug: null, type: "any", severity: "INFO", count: 3, firstSeenAt: "", lastSeenAt: "" },
      ],
      growth7d: { current: 8, previous: 0, delta: 8, rate: 1 },
      growth30d: { current: 8, previous: 0, delta: 8, rate: 1, series: [{ day: "2026-04-10", total: 5 }] },
    },
    mrr30d: { current: 3200, previous: 3000, delta: 200, rate: 200 / 3000 },
  };
  return { ...base, ...(partial || {}) };
}

describe("orchestrator/qa", () => {
  it("intención 'mejor SaaS'", () => {
    const snap = makeBaseSnapshot();
    const ans = answerQuestion("¿Cuál SaaS va mejor?", snap);
    expect(ans.intent).toBe("best_saas");
    expect((ans.facts as any).best.saasId).toBe("s2");
  });

  it("intención 'peor SaaS'", () => {
    const snap = makeBaseSnapshot();
    const ans = answerQuestion("¿Cuál va peor?", snap);
    expect(ans.intent).toBe("worst_saas");
    expect((ans.facts as any).worst.saasId).toBe("s2");
  });

  it("intención 'peor margen'", () => {
    const snap = makeBaseSnapshot();
    const ans = answerQuestion("¿Cuál tiene peor margen?", snap);
    expect(ans.intent).toBe("worst_margin");
    expect((ans.facts as any).worstMargin.saasId).toBe("s2");
  });

  it("intención 'alertas críticas'", () => {
    const snap = makeBaseSnapshot();
    const ans = answerQuestion("¿Hay alertas críticas?", snap);
    expect(ans.intent).toBe("critical_alerts");
    expect((ans.facts as any).criticalEvents.length).toBeGreaterThan(0);
  });

  it("intención 'evolución'", () => {
    const snap = makeBaseSnapshot();
    const ans = answerQuestion("Muéstrame la evolución 30 días", snap);
    expect(ans.intent).toBe("evolution");
    expect((ans.facts as any).events30d.current).toBe(8);
    expect((ans.facts as any).mrr30d.current).toBe(3200);
  });

  it("intención 'qué revisar primero'", () => {
    const snap = makeBaseSnapshot();
    const ans = answerQuestion("¿Qué debería revisar primero?", snap);
    expect(ans.intent).toBe("what_to_review_first");
    const f = ans.facts as any;
    expect(Array.isArray(f.critical)).toBe(true);
    expect(Array.isArray(f.lowMargin)).toBe(true);
    expect(Array.isArray(f.socialOff)).toBe(true);
  });
});
