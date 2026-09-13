import { defaultLocalModel } from "@/lib/socialflow/ai/models/localModel";
import type { LeadDetectionResult } from "@/lib/socialflow/leads/types";

export type CommentSentiment = "positive" | "negative" | "neutral" | "lead";

export type SentimentResult = {
  sentiment: CommentSentiment;
  confidence: number;
  shouldAutoReply: boolean;
  reason: string;
};

type SentimentOutput = {
  sentiment: CommentSentiment;
  confidence: number;
  reason: string;
};

function baseSentiment(): SentimentOutput {
  return { sentiment: "neutral", confidence: 0.5, reason: "Could not classify." };
}

// Classifies sentiment of a social media comment using Workers AI.
// Decision rule: negative sentiment or confidence < 0.6 → shouldAutoReply = false (NEEDS_HUMAN).
export async function analyzeSentiment(
  text: string,
  knowledgeContext: string,
  tenantId: string,
  saasId: string,
): Promise<SentimentResult> {
  const context = knowledgeContext
    ? `Brand knowledge context (use to judge purchase intent):\n${knowledgeContext.slice(0, 800)}\n\n`
    : "";

  const prompt = `${context}Classify the sentiment of this social media comment. Reply with ONLY valid JSON — no markdown.

Comment: "${text.slice(0, 500)}"

Return JSON:
{
  "sentiment": "positive" | "negative" | "neutral" | "lead",
  "confidence": 0.0 to 1.0,
  "reason": "one sentence explanation"
}

Definitions:
- positive: compliment, enthusiasm, support, general appreciation
- negative: complaint, criticism, frustration, offensive content
- neutral: general question, informational comment, neither positive nor negative
- lead: asks about pricing, services, how to buy, booking, consultation — purchase intent`;

  const { data } = await defaultLocalModel.generateStructured<SentimentOutput>(
    { prompt, tenantId, saasId },
    baseSentiment,
  );

  const sentiment: CommentSentiment =
    ["positive", "negative", "neutral", "lead"].includes(data.sentiment)
      ? data.sentiment
      : "neutral";

  const confidence =
    typeof data.confidence === "number" && data.confidence >= 0 && data.confidence <= 1
      ? data.confidence
      : 0.5;

  const shouldAutoReply = sentiment !== "negative" && confidence >= 0.6;

  return {
    sentiment,
    confidence,
    shouldAutoReply,
    reason: typeof data.reason === "string" ? data.reason : "",
  };
}

// El regex de leads/detector.ts es literal: "cómo funciona esto para mi negocio" es
// intención de compra real que el LLM sí capta por contexto pero que no matchea ningún
// patrón, así que sin esto se perdía como lead. Cuando el LLM clasifica "lead" y el
// regex dio 0, no sabemos su intentScore real — WARM=30 es un mínimo razonable, ni tan
// bajo como para no aparecer en el panel ni tan alto como para inflar HOT sin evidencia
// del regex.
const LLM_ONLY_LEAD_SCORE = 30;

export function reconcileLeadSignals(
  sentiment: SentimentResult,
  regexResult: LeadDetectionResult,
): LeadDetectionResult {
  if (regexResult.isLead) return regexResult;
  if (sentiment.sentiment !== "lead") return regexResult;
  return { isLead: true, intentScore: LLM_ONLY_LEAD_SCORE, temperature: "WARM" };
}
