import type { FutureProjection } from "@/lib/behavioral-engine/contracts";

export function normalizeFutureProjection(projection: FutureProjection): FutureProjection {
  return {
    ...projection,
    evidence: projection.evidence.filter(Boolean),
    bridgeAction: projection.bridgeAction?.trim() ?? null,
  };
}
