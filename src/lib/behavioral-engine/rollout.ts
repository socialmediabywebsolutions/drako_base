export type BehavioralEngineRolloutMode =
  | "shadow_only"
  | "engine_strategy"
  | "engine_strategy_and_explanation";

const DEFAULT_BEHAVIORAL_ENGINE_ROLLOUT: BehavioralEngineRolloutMode = "shadow_only";

export function parseBehavioralEngineRolloutMode(value: string | null | undefined): BehavioralEngineRolloutMode {
  if (value === "engine_strategy" || value === "engine_strategy_and_explanation" || value === "shadow_only") {
    return value;
  }
  return DEFAULT_BEHAVIORAL_ENGINE_ROLLOUT;
}

export function getMentoriaBehavioralEngineRollout(): BehavioralEngineRolloutMode {
  return parseBehavioralEngineRolloutMode(
    process.env.MENTORIA_BEHAVIORAL_ENGINE_ROLLOUT
    ?? process.env.NEXT_PUBLIC_MENTORIA_BEHAVIORAL_ENGINE_ROLLOUT
    ?? null,
  );
}

export function shouldUseEngineStrategy(mode: BehavioralEngineRolloutMode): boolean {
  return mode === "engine_strategy" || mode === "engine_strategy_and_explanation";
}

export function shouldUseEngineExplanation(mode: BehavioralEngineRolloutMode): boolean {
  return mode === "engine_strategy_and_explanation";
}
