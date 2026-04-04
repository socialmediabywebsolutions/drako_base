import type { BehaviorSignals } from "@/lib/behavioral-engine/contracts";

export type BehavioralAdaptationSnapshot = {
  difficultyMode: "down" | "steady" | "up";
  toneMode: "support" | "steady" | "push";
};

export function buildBehavioralAdaptationSnapshot(signals: BehaviorSignals): BehavioralAdaptationSnapshot {
  if ((signals.frustrationLevel ?? 0) >= 0.6 || signals.motivationProfile === "fragile") {
    return {
      difficultyMode: "down",
      toneMode: "support",
    };
  }

  if ((signals.progressionVelocity ?? 0) >= 0.7 && (signals.consistencyScore ?? 0) >= 0.55) {
    return {
      difficultyMode: "up",
      toneMode: "push",
    };
  }

  return {
    difficultyMode: "steady",
    toneMode: "steady",
  };
}
