import { defaultLocalModel } from "../ai/models/localModel";
import { getNicheIntelligence, getStyleHistory, detectContentFatigue, type Env } from "./NicheIntelligenceService";

export type ViralScoreLabel = "Bajo" | "Medio" | "Alto" | "Viral";

export type ViralScoreFormat = "POST" | "REEL" | "HISTORIA" | "CARRUSEL";

export type ViralScoreFactors = {
  hooks: number;
  hashtags: number;
  format: number;
  timing: number;
  niche_alignment: number;
};

export type ViralScore = {
  score: number;
  label: ViralScoreLabel;
  explanation: string;
  improvements: string[];
  factors: ViralScoreFactors;
};

// Maps the platform-facing content type (as used across saas_social_posts /
// SaasSocialContentType) to the Spanish labels this agent's prompt/UI use.
// CAROUSEL has no source here today — none of the current call sites (single-photo
// generation) produce it — included for completeness/forward compatibility.
const CONTENT_TYPE_TO_VIRAL_FORMAT: Record<string, ViralScoreFormat> = {
  FEED: "POST",
  REEL: "REEL",
  STORY: "HISTORIA",
  CAROUSEL: "CARRUSEL",
};

export function mapContentTypeToViralFormat(contentType: string): ViralScoreFormat {
  return CONTENT_TYPE_TO_VIRAL_FORMAT[contentType] ?? "POST";
}

function labelForScore(score: number): ViralScoreLabel {
  if (score >= 9) return "Viral";
  if (score >= 7) return "Alto";
  if (score >= 5) return "Medio";
  return "Bajo";
}

function clampScore(value: unknown, fallback: number): number {
  const num = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.round(Math.min(10, Math.max(1, num)) * 10) / 10;
}

function buildNeutralScore(): ViralScore {
  return {
    score: 5,
    label: "Medio",
    explanation: "No se pudo generar un análisis detallado en este momento, así que se asigna una puntuación neutra por defecto.",
    improvements: [
      "Revisa que el hook de apertura enganche en los primeros segundos.",
      "Asegúrate de que los hashtags sean específicos del nicho, no genéricos.",
    ],
    factors: { hooks: 5, hashtags: 5, format: 5, timing: 5, niche_alignment: 5 },
  };
}

type ViralScorePayload = {
  score: number;
  explanation: string;
  improvements: string[];
  factors: Partial<ViralScoreFactors>;
};

// generateStructured() decorates its result with _meta.engine — "workers-ai" on a
// real model response, "local-deterministic-stub" on any failure (see
// WorkersAiLocalModel.generateStructured). Checked below instead of trusting an
// empty/seed response as a real evaluation.
type ViralScoreResult = ViralScorePayload & { _meta?: { engine?: string } };

function buildViralScorePrompt(input: {
  caption: string;
  hashtags: string[];
  format: ViralScoreFormat;
  niche: string;
  nicheHashtags: string[];
  nicheFormats: string[];
  nicheHooks: string[];
  fatigueDescription: string | null;
}): string {
  return `Eres un analista de contenido viral especializado en el nicho "${input.niche}" para Instagram en español. Evalúa el siguiente post ANTES de publicarse y da una puntuación realista de 1 a 10 (con un decimal) de su potencial de rendimiento. Sé honesto y crítico — no des siempre puntuaciones altas.

Post a evaluar (formato: ${input.format}):
"""
${input.caption}
"""
Hashtags: ${input.hashtags.join(" ") || "(ninguno)"}

${input.nicheHashtags.length ? `Hashtags en tendencia en el nicho ahora mismo: ${input.nicheHashtags.slice(0, 10).join(" ")}\n` : ""}${input.nicheFormats.length ? `Formatos que están funcionando en el nicho: ${input.nicheFormats.join(", ")}\n` : ""}${input.nicheHooks.length ? `Hooks que están funcionando en el nicho: ${input.nicheHooks.slice(0, 5).join(" | ")}\n` : ""}${input.fatigueDescription ? `⚠️ Fatiga de contenido detectada en este tenant: ${input.fatigueDescription}\n` : ""}
Evalúa específicamente:
1. ¿El hook de apertura engancha en los primeros 3 segundos de lectura?
2. ¿Los hashtags son relevantes para el nicho ahora mismo, no genéricos?
3. ¿El formato elegido (${input.format}) está funcionando bien en este nicho?
4. ¿El contenido está alineado con las tendencias actuales del nicho?
5. ¿Hay señales de que este tipo de contenido ya está sobreexplotado (fatiga)?

Responde SOLO con un objeto JSON válido, sin markdown ni backticks, con esta forma exacta:
{
  "score": 7.4,
  "explanation": "1-2 frases en español explicando la puntuación",
  "improvements": ["2 a 3 sugerencias concretas y accionables en español para mejorar este post"],
  "factors": { "hooks": 8, "hashtags": 7, "format": 7, "timing": 6, "niche_alignment": 8 }
}`;
}

// Never throws — this runs in the hot path of a user-facing generation request
// (see posts/generate-from-image and campaigns/[id]/photos), so any failure
// (missing niche data, model outage, malformed JSON) degrades to a neutral 5.0
// score instead of blocking the response.
export async function calculateViralScore(input: {
  caption: string;
  hashtags: string[];
  format: ViralScoreFormat;
  niche: string;
  tenantId: string;
  saasId: string;
  env: Env;
}): Promise<ViralScore> {
  try {
    const [nicheIntel, styleHistory] = await Promise.all([
      getNicheIntelligence(input.niche, input.env),
      getStyleHistory(input.tenantId, input.saasId, input.env),
    ]);
    const fatigueWarning = detectContentFatigue(styleHistory);

    const seed: ViralScorePayload = {
      score: 5,
      explanation: "",
      improvements: [],
      factors: { hooks: 5, hashtags: 5, format: 5, timing: 5, niche_alignment: 5 },
    };

    const { data } = await defaultLocalModel.generateStructured<ViralScoreResult>(
      {
        prompt: buildViralScorePrompt({
          caption: input.caption,
          hashtags: input.hashtags,
          format: input.format,
          niche: input.niche,
          nicheHashtags: nicheIntel?.hashtags ?? [],
          nicheFormats: nicheIntel?.formats ?? [],
          nicheHooks: nicheIntel?.hooks ?? [],
          fatigueDescription: fatigueWarning?.description ?? null,
        }),
        tenantId: input.tenantId,
        saasId: input.saasId,
      },
      () => seed as ViralScoreResult,
    );

    if (data._meta?.engine !== "workers-ai") {
      return buildNeutralScore();
    }

    const score = clampScore(data.score, 5);
    const fallback = buildNeutralScore();

    return {
      score,
      // Derived from score rather than trusting the model's own label, so the two
      // can never disagree (e.g. score 8.5 with label "Medio").
      label: labelForScore(score),
      explanation: typeof data.explanation === "string" && data.explanation.trim() ? data.explanation.trim() : fallback.explanation,
      improvements: Array.isArray(data.improvements) && data.improvements.length ? data.improvements.slice(0, 3) : fallback.improvements,
      factors: {
        hooks: clampScore(data.factors?.hooks, score),
        hashtags: clampScore(data.factors?.hashtags, score),
        format: clampScore(data.factors?.format, score),
        timing: clampScore(data.factors?.timing, score),
        niche_alignment: clampScore(data.factors?.niche_alignment, score),
      },
    };
  } catch (err) {
    console.error("[ViralScoreAgent] calculateViralScore failed, returning neutral score", err instanceof Error ? err.message : String(err));
    return buildNeutralScore();
  }
}
