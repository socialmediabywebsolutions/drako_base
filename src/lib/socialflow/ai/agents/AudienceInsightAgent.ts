import { resolveSocialContext } from "@/lib/socialflow/repository";
import { defaultLocalModel } from "../models/localModel";
import { seedFeedItems } from "@/lib/socialflow/intelligence/repository";
import type { IntelligenceFeedPriority } from "@/lib/socialflow/intelligence/types";

const MIN_COMMENTS = 10;
const MAX_COMMENTS = 100;
const MAX_BUCKETS_IN_PROMPT = 15;
const MAX_EXAMPLES_PER_BUCKET = 3;
const SOURCE = "audience-insight-agent";

type CommentRow = { incoming_message: string; created_at: string };

// "?" cubre la inmensa mayoría; el prefijo cubre preguntas sin signo de interrogación
// (frecuente en comentarios reales de Instagram, escritos rápido desde el móvil).
const QUESTION_STARTERS =
  /^\s*(?:¿\s*)?(que|qué|como|cómo|cuando|cuándo|donde|dónde|cuanto|cuánto|cuanta|cuánta|cual|cuál|por que|por qué|puedes|podrias|podrías|tienes|me puedes)\b/i;

function isQuestionComment(text: string): boolean {
  if (text.includes("?")) return true;
  return QUESTION_STARTERS.test(text.trim());
}

// Stopwords + las propias palabras interrogativas (si no se excluyeran, dominarían
// todas las keys y agruparían por igual "qué ejercicio" con "qué ropa"). No es NLP real
// — es una aproximación barata para armar buckets ANTES de la única llamada a Mistral,
// que es quien hace la clasificación semántica de verdad (ver prompt más abajo).
const STOPWORDS = new Set([
  "que", "qué", "como", "cómo", "cuando", "cuándo", "donde", "dónde", "cuanto", "cuánto",
  "cuanta", "cuánta", "cual", "cuál", "cuales", "cuáles", "por", "puedes", "podrias", "podrías",
  "tienes", "para", "esto", "esta", "estos", "estas", "pero", "porque", "todo", "toda", "todos",
  "todas", "muy", "mas", "más", "mucho", "poco", "sobre", "entre", "hasta", "desde", "cada",
  "otro", "otra", "otros", "otras", "eres", "sido", "hace", "hacer", "quiere", "quieres",
  "tiene", "tienen", "vamos", "solo", "sino", "aqui", "así", "nunca", "siempre", "nadie",
  "algo", "alguien", "también", "tambien", "una", "unos", "unas", "los", "las", "del", "con",
  "me", "mi", "tu", "su", "es", "en", "el", "la", "un",
]);

function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Key aproximada de 1-3 palabras significativas (sin stopwords ni interrogativos) — no
// es agrupación palabra por palabra, es una frase corta que actúa de bucket temático
// (ej. "ejercicio brazos" agrupa "¿qué ejercicio haces para los brazos?" con "¿cómo
// entrenas los brazos?"). Aproximada a propósito: el agrupamiento fino de verdad lo
// hace Mistral con estos buckets como entrada, no esta función.
function extractTopicKey(text: string): string {
  const normalized = normalizeText(text).replace(/[¿?¡!.,;:]/g, " ");
  const words = normalized.match(/[a-z]{3,}/g) ?? [];
  const significant = words.filter((w) => !STOPWORDS.has(w)).slice(0, 3);
  return significant.length ? significant.join(" ") : "general";
}

function buildBuckets(questionTexts: string[]): Map<string, string[]> {
  const buckets = new Map<string, string[]>();
  for (const text of questionTexts) {
    const key = extractTopicKey(text);
    const list = buckets.get(key) ?? [];
    list.push(text);
    buckets.set(key, list);
  }
  return buckets;
}

function buildPrompt(buckets: Map<string, string[]>): string {
  const topBuckets = Array.from(buckets.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MAX_BUCKETS_IN_PROMPT);

  const bucketLines = topBuckets
    .map(([key, texts]) => {
      const examples = texts.slice(0, MAX_EXAMPLES_PER_BUCKET).map((t) => `"${t.slice(0, 200)}"`).join(" | ");
      return `- Tema aproximado "${key}" (${texts.length} comentarios). Ejemplos reales: ${examples}`;
    })
    .join("\n");

  return `Eres un analista de la audiencia de una cuenta de Instagram. A continuación tienes comentarios reales de seguidores que contienen preguntas, agrupados de forma aproximada por similitud de tema (la agrupación es solo una pista, no es definitiva — tú decides la clasificación real):

${bucketLines}

Identifica los patrones de pregunta MÁS FRECUENTES y genuinamente recurrentes (máximo 3) — no listes preguntas triviales, únicas o que no representen una oportunidad de contenido real. Puedes fusionar varios de los "temas aproximados" de arriba en un solo patrón si en realidad preguntan lo mismo.

Para cada patrón, responde con estos campos exactos:
- "pattern": descripción corta del patrón de pregunta, en español (ej. "Preguntan qué ejercicio hacer para brazos")
- "frequency": número aproximado de comentarios que encajan en este patrón — usa los conteos reales de arriba, no inventes cifras mayores
- "title": título corto y accionable para una sugerencia de contenido (máximo 8 palabras)
- "description": descripción accionable de qué contenido crear para responder esta pregunta recurrente, en español, ~50 palabras
- "content_type": exactamente uno de "post", "carrusel" o "reel" — el formato que mejor encaja para responder esta pregunta

Responde SOLO con un array JSON válido, sin markdown, sin backticks, sin texto fuera del JSON, con esta forma exacta:
[{"pattern": "...", "frequency": 0, "title": "...", "description": "...", "content_type": "post"}]

Si ningún patrón es genuinamente recurrente (todas las preguntas son distintas y aisladas), responde con un array vacío: [].
Responde TODO en español.`;
}

type QuestionInsight = {
  pattern: string;
  frequency: number;
  title: string;
  description: string;
  content_type: "post" | "carrusel" | "reel";
};

// generateStructured() decora el resultado con _meta.engine — igual criterio que
// NicheIntelligenceCronAgent/SeasonalityAgent: "workers-ai" en una respuesta real,
// "local-deterministic-stub" ante cualquier fallo. Comprobarlo es lo que evita escribir
// en socialflow_intelligence_feed el seed vacío del stub como si fueran insights reales.
type QuestionInsightArray = QuestionInsight[] & { _meta?: { engine?: string } };

function priorityForFrequency(frequency: number): IntelligenceFeedPriority {
  if (frequency >= 5) return "high";
  if (frequency >= 3) return "medium";
  return "low";
}

export class AudienceInsightAgent {
  async run(input: { tenantId: string; saasId: string }): Promise<QuestionInsight[] | null> {
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });

    // listConversationThreads no filtra por thread_type (ver auditoría) — query directa,
    // mismo criterio de acceso a ctx.socialDb que ya usa intelligence/repository.ts.
    const result = await ctx.socialDb
      .prepare(
        `SELECT incoming_message, created_at
         FROM socialflow_conversation_threads
         WHERE thread_type = 'COMMENT' AND tenant_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(input.tenantId, MAX_COMMENTS)
      .all<CommentRow>();

    const comments = result.results ?? [];
    if (comments.length < MIN_COMMENTS) return null;

    const questionTexts = comments
      .map((c) => c.incoming_message?.trim())
      .filter((text): text is string => Boolean(text) && isQuestionComment(text));

    if (questionTexts.length === 0) return null;

    const buckets = buildBuckets(questionTexts);
    const prompt = buildPrompt(buckets);

    const seed: QuestionInsight[] = [];
    const { data } = await defaultLocalModel.generateStructured<QuestionInsightArray>(
      { prompt, tenantId: input.tenantId, saasId: input.saasId },
      () => seed as QuestionInsightArray,
    );

    if (data._meta?.engine !== "workers-ai") {
      console.error("[AudienceInsightAgent] model generation failed or returned invalid JSON, skipping", input.tenantId);
      return null;
    }

    const insights = Array.isArray(data) ? data.slice(0, 3) : [];
    if (insights.length === 0) return null;

    await seedFeedItems(
      input.tenantId,
      insights.map((insight) => ({
        type: "opportunity" as const,
        priority: priorityForFrequency(insight.frequency),
        title: insight.title,
        description: insight.description,
        actionLabel: "Crear contenido",
        actionHref: "/socialflow/upload",
        source: SOURCE,
      })),
      input.saasId,
    );

    return insights;
  }
}
