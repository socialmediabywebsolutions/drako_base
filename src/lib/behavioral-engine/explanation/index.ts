import type { BehavioralContext, NextBestAction } from "@/lib/behavioral-engine/contracts";

export type BehavioralExplanation = {
  whyToday: string;
  expectedOutcome: string;
};

export function buildBehavioralExplanation(action: NextBestAction, context: BehavioralContext): BehavioralExplanation {
  const since = context.signals.hoursSinceActivity;
  const when = since === null ? "sin una referencia temporal clara" : `despues de ${Math.round(since)} horas`;

  return {
    whyToday: `${action.title}. Esta decision nace ${when} y usa el estado actual del usuario para reducir friccion.`,
    expectedOutcome: action.description,
  };
}
