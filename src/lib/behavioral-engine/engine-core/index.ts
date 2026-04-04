import type { BehavioralContext, NextBestAction } from "@/lib/behavioral-engine/contracts";
import { decideNextBestAction } from "@/lib/behavioral-engine/decision";

export type BehavioralEngineResult = {
  context: BehavioralContext;
  nextBestAction: NextBestAction;
};

export function runBehavioralEngine(context: BehavioralContext): BehavioralEngineResult {
  return {
    context,
    nextBestAction: decideNextBestAction(context),
  };
}
