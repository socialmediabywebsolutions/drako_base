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
  { pattern: /\bcat[aá]logo\b/i, weight: 20 },
  { pattern: /\bhorarios?\b/i, weight: 15 },
  { pattern: /\bstock\b|\bdisponibilidad\b/i, weight: 18 },
  { pattern: /\benv[ií]o\b/i, weight: 15 },
  { pattern: /\breserva\b|\breservar\b/i, weight: 25 },
  { pattern: /\bcita\b/i, weight: 25 },
  { pattern: /\bpresupuesto\b/i, weight: 28 },
  { pattern: /\bwhatsapp\b/i, weight: 20 },
  // Colaboración / monetización influencer
  { pattern: /\bcolaboraci[oó]n\b|\bcollab\b/i, weight: 45 },
  { pattern: /\bpatrocinio\b|\bsponsor\b|\bsponsorship\b/i, weight: 45 },
  { pattern: /\bembajadora\b|\bembajador\b|\bbrand\s+ambassador\b/i, weight: 40 },
  { pattern: /\brepresentas\b|\brepresentaci[oó]n\b/i, weight: 35 },
  { pattern: /\bprograma\s+de\s+entrenamiento\b|\bplan\s+de\s+entreno\b/i, weight: 40 },
  { pattern: /\bentrenamiento\s+personalizado\b|\brutina\s+personalizada\b/i, weight: 38 },
  { pattern: /\bcoaching\b|\bcoach\b/i, weight: 35 },
  { pattern: /\bases[oa]r[ií]a\b|\bases[oa]ramiento\b/i, weight: 32 },
  { pattern: /c[oó]mo\s+te\s+contrato\b|\bcontratar\b/i, weight: 42 },
  { pattern: /\btrabajar\s+contigo\b|\btrabajar\s+juntos\b/i, weight: 38 },
  { pattern: /\bpropuesta\b|\bproposal\b/i, weight: 30 },
  { pattern: /\bpublicidad\b|\bpubli\b|\bpublicitar\b/i, weight: 35 },
  { pattern: /\bmenci[oó]n\b|\bmencionar\b|\bstory\s+pagada\b/i, weight: 32 },
  { pattern: /\bgifting\b|\bregalo\b|\benv[ií]o\s+de\s+producto\b/i, weight: 28 },
  { pattern: /\bdescuento\b|\bc[oó]digo\s+descuento\b|\baffiliate\b/i, weight: 25 },
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
