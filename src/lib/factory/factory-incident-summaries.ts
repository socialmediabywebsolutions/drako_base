export type FactoryIncidentSummary = {
  total: number;
  stableCount: number;
  degradedCount: number;
  improvedCount: number;
  lastOutcome: string | null;
};

export function summarizeFactoryIncidents(outcomes: string[]): FactoryIncidentSummary {
  return {
    total: outcomes.length,
    stableCount: outcomes.filter((outcome) => outcome === "stable").length,
    degradedCount: outcomes.filter((outcome) => outcome === "degraded").length,
    improvedCount: outcomes.filter((outcome) => outcome === "improved").length,
    lastOutcome: outcomes.at(-1) ?? null,
  };
}
