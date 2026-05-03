import { runSocialFlowEngine, type SocialFlowEngineInput, type SocialFlowEngineOutput } from "@/lib/socialflow/ai/socialflow-engine";

export type SocialFlowAutomationRunInput = SocialFlowEngineInput;
export type SocialFlowAutomationRunOutput = SocialFlowEngineOutput;

/**
 * Contract used by Campamento Base to request a SocialFlow automation run.
 * It is intentionally thin: operator code knows this contract, not the
 * product engine internals.
 */
export async function runSocialFlowAutomationContract(
  input: SocialFlowAutomationRunInput,
): Promise<SocialFlowAutomationRunOutput> {
  return runSocialFlowEngine(input);
}

