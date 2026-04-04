export type BehavioralIdentityFrame = {
  headline: string;
  evidence: string[];
};

export function buildBehavioralIdentityFrame(input: BehavioralIdentityFrame): BehavioralIdentityFrame {
  return {
    ...input,
    evidence: input.evidence.filter(Boolean),
  };
}
