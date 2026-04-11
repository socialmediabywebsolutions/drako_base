import { CampamentoBaseSnapshot, OrchestratorAnswer, OrchestratorIntent, SaasRow } from "./types";

function pickBestSaas(rows: SaasRow[]): SaasRow | undefined {
  return rows
    .slice()
    .sort((a, b) => {
      if (b.mrr !== a.mrr) return b.mrr - a.mrr;
      const ma = typeof a.marginPct === "number" ? a.marginPct : -1;
      const mb = typeof b.marginPct === "number" ? b.marginPct : -1;
      if (mb !== ma) return mb - ma;
      const ea = typeof a.marginEur === "number" ? a.marginEur : -1;
      const eb = typeof b.marginEur === "number" ? b.marginEur : -1;
      return eb - ea;
    })[0];
}

function pickWorstSaas(rows: SaasRow[]): SaasRow | undefined {
  return rows
    .slice()
    .sort((a, b) => {
      const ma = typeof a.marginPct === "number" ? a.marginPct : Number.POSITIVE_INFINITY;
      const mb = typeof b.marginPct === "number" ? b.marginPct : Number.POSITIVE_INFINITY;
      if (ma !== mb) return ma - mb; // peor margen primero
      if (a.mrr !== b.mrr) return a.mrr - b.mrr; // menor MRR si empata
      return (a.opsSeverity === "CRITICAL" ? -1 : 0) - (b.opsSeverity === "CRITICAL" ? -1 : 0);
    })[0];
}

function pickWorstMargin(rows: SaasRow[]): SaasRow | undefined {
  return rows
    .filter((r) => typeof r.marginPct === "number")
    .slice()
    .sort((a, b) => (a.marginPct! - b.marginPct!))[0];
}

export function answerQuestion(query: string, snapshot: CampamentoBaseSnapshot): OrchestratorAnswer {
  const q = (query || "").toLowerCase();
  const rows = snapshot.saas;

  const hasCritical = (snapshot.governance?.critical ?? 0) > 0 || snapshot.events.criticalEvents.some((e) => String(e.severity).toUpperCase().includes("CRITICAL"));

  const evolutionFacts = {
    events7d: snapshot.events.growth7d,
    events30d: snapshot.events.growth30d,
    mrr30d: snapshot.mrr30d ?? undefined,
  };

  const intentMatchers: Array<{ intent: OrchestratorIntent; match: (q: string) => boolean; make: () => OrchestratorAnswer }> = [
    {
      intent: "best_saas",
      match: (qq) => /(mejor|top|va mejor|líder)/.test(qq),
      make: () => {
        const best = pickBestSaas(rows);
        return {
          intent: "best_saas",
          summary: best
            ? `El SaaS con mejor desempeño es ${best.saasName} (MRR €${Math.round(best.mrr)}, margen ${typeof best.marginPct === "number" ? Math.round(best.marginPct * 100) + "%" : "-"}, ops ${best.opsSeverity ?? "-"}).`
            : "No hay datos suficientes para determinar el mejor SaaS.",
          facts: { best },
          evidence: { ordering: "MRR desc, margen% desc, margen€ desc" },
        };
      },
    },
    {
      intent: "worst_margin",
      match: (qq) => /(peor margen|margen más bajo|margen bajo)/.test(qq),
      make: () => {
        const wm = pickWorstMargin(rows);
        return {
          intent: "worst_margin",
          summary: wm
            ? `Peor margen: ${wm.saasName} con ${typeof wm.marginPct === "number" ? Math.round(wm.marginPct * 100) + "%" : "-"} (MRR €${Math.round(wm.mrr)}).`
            : "No hay márgenes disponibles para comparar.",
          facts: { worstMargin: wm },
          evidence: { ordering: "margen% asc" },
        };
      },
    },
    {
      intent: "worst_saas",
      match: (qq) => /(peor|va peor|bottom|rendimiento bajo)/.test(qq),
      make: () => {
        const worst = pickWorstSaas(rows);
        return {
          intent: "worst_saas",
          summary: worst
            ? `El SaaS con peor desempeño es ${worst.saasName} (MRR €${Math.round(worst.mrr)}, margen ${typeof worst.marginPct === "number" ? Math.round(worst.marginPct * 100) + "%" : "-"}, ops ${worst.opsSeverity ?? "-"}).`
            : "No hay datos suficientes para determinar el peor SaaS.",
          facts: { worst },
          evidence: { ordering: "margen% asc, MRR asc, CRITICAL primero" },
        };
      },
    },
    {
      intent: "critical_alerts",
      match: (qq) => /(alertas|críticas|críticos|incidentes)/.test(qq),
      make: () => {
        const top = snapshot.events.criticalEvents.slice(0, 3);
        return {
          intent: "critical_alerts",
          summary: hasCritical
            ? `Hay alertas críticas activas (${top.length} mostradas).`
            : "No hay alertas críticas registradas recientemente.",
          facts: { governanceCritical: snapshot.governance?.critical ?? 0, criticalEvents: top },
          evidence: { source: ["/api/operator/events", "/api/operator/governance"] },
        };
      },
    },
    {
      intent: "evolution",
      match: (qq) => /(evolución|tendencia|7 días|30 días|7d|30d|cómo va)/.test(qq),
      make: () => {
        const e7 = snapshot.events.growth7d;
        const e30 = snapshot.events.growth30d;
        const m30 = snapshot.mrr30d;
        const parts: string[] = [
          `Eventos 7d: ${e7.current} (${e7.delta >= 0 ? "+" : ""}${e7.delta}, ${Math.round(e7.rate * 100)}%).`,
          `Eventos 30d: ${e30.current} (${e30.delta >= 0 ? "+" : ""}${e30.delta}, ${Math.round(e30.rate * 100)}%).`,
        ];
        if (m30) parts.push(`MRR 30d: €${Math.round(m30.current)}${typeof m30.delta === "number" ? ` (${m30.delta >= 0 ? "+" : ""}${Math.round(m30.delta)}, ${typeof m30.rate === "number" ? Math.round(m30.rate * 100) : "-"}%).` : "."}`);
        return {
          intent: "evolution",
          summary: parts.join(" "),
          facts: evolutionFacts,
          evidence: { series30d: snapshot.events.growth30d.series },
        };
      },
    },
    {
      intent: "what_to_review_first",
      match: (qq) => /(qué revisar|prioridad|primero|next|recomienda)/.test(qq),
      make: () => {
        // Prioridad: 1) CRITICAL; 2) margen < 30% con MRR alto; 3) Social OFF; 4) picos negativos
        const critical = rows.filter((r) => r.opsSeverity === "CRITICAL");
        const lowMargin = rows
          .filter((r) => typeof r.marginPct === "number")
          .filter((r) => (r.marginPct as number) < 0.3)
          .sort((a, b) => b.mrr - a.mrr)
          .slice(0, 3);
        const socialOff = rows.filter((r) => r.socialEnabled === false).slice(0, 3);
        const e30 = snapshot.events.growth30d;
        const m30 = snapshot.mrr30d;
        const negatives = {
          eventsSpike: e30.delta > 0 && e30.rate > 0.2, // crecimiento de eventos
          mrrDrop: typeof m30?.delta === "number" ? m30.delta < 0 : false,
        };
        const summary = [
          critical.length ? `${critical.length} SaaS con CRITICAL.` : undefined,
          lowMargin.length ? `Márgenes <30% en top ${lowMargin.length} por MRR.` : undefined,
          socialOff.length ? `${socialOff.length} con SocialFlow OFF.` : undefined,
          negatives.eventsSpike ? "Eventos subiendo en 30d." : undefined,
          negatives.mrrDrop ? "MRR cayendo en 30d." : undefined,
        ]
          .filter(Boolean)
          .join(" ") || "Sin prioridades evidentes.";
        return {
          intent: "what_to_review_first",
          summary,
          facts: { critical, lowMargin, socialOff, negatives },
          evidence: { ordering: ["CRITICAL", "margen%<30% por MRR", "Social OFF", "evolución negativa"] },
        };
      },
    },
  ];

  for (const it of intentMatchers) if (it.match(q)) return it.make();

  // Default: devolver evolución global como respuesta segura
  return {
    intent: "evolution",
    summary: `Eventos 7d: ${snapshot.events.growth7d.current}. Eventos 30d: ${snapshot.events.growth30d.current}.` +
      (snapshot.mrr30d ? ` MRR 30d: €${Math.round(snapshot.mrr30d.current)}.` : ""),
    facts: evolutionFacts,
  };
}
