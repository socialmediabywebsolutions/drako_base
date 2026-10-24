import type { ClosureSummary } from "@/lib/behavioral-engine/contracts";

export function normalizeClosureSummary(summary: ClosureSummary): ClosureSummary {
  return {
    ...summary,
    summary: summary.summary.trim(),
    carryOverPrompt: summary.carryOverPrompt?.trim() ?? null,
  };
}
