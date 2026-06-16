import type { LeadDetectionResult, LeadTemperature } from "./types";

const SIGNALS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /c[oó]mo\s+compro\b/i, weight: 40 },
  { pattern: /c[oó]mo\s+adquiero\b/i, weight: 35 },
  { pattern: /\bcomprar\b/i, weight: 30 },
  { pattern: /\bpagar\b/i, weight: 28 },
  { pattern: /\bme\s+interesa\b/i, weight: 25 },
  { pattern: /\bprecio\b/i, weight: 25 },
  { pattern: /\bdisponible\b/i, weight: 22 },
  { pattern: /\binteresad[oa]\b/i, weight: 20 },
  { pattern: /\bcu[aá]nt[ao]\b/i, weight: 20 },
  { pattern: /\bquiero\b/i, weight: 15 },
  { pattern: /\bnecesito\b/i, weight: 15 },
  { pattern: /informaci[oó]n\b|\binfo\b/i, weight: 12 },
];

function scoreMessage(message: string): number {
  let total = 0;
  for (const { pattern, weight } of SIGNALS) {
    if (pattern.test(message)) total += weight;
  }
  return Math.min(100, total);
}

function classifyTemperature(score: number): LeadTemperature {
  if (score >= 60) return "HOT";
  if (score >= 30) return "WARM";
  return "COLD";
}

export function detectLeadSignals(message: string): LeadDetectionResult {
  const intentScore = scoreMessage(message);
  if (intentScore === 0) return { isLead: false, intentScore: 0, temperature: null };
  return { isLead: true, intentScore, temperature: classifyTemperature(intentScore) };
}
