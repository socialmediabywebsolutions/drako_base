import { defaultLocalModel } from "../models/localModel";
import { resolveSocialContext } from "@/lib/socialflow/repository";
import { env, type DracoEnv } from "@/lib/cf";
import { seedFeedItems, dismissFeedItemsBySource } from "@/lib/socialflow/intelligence/repository";
import type { IntelligenceFeedPriority } from "@/lib/socialflow/intelligence/types";

const MAX_COMMENTS = 100;
const MIN_COMMENTS = 20;
const CHUNK_SIZE = 20;
const RECENT_WINDOW = 30;
const HIGH_THRESHOLD = 0.3;
const MEDIUM_THRESHOLD = 0.15;
const TREND_EPSILON = 0.05;
const MIN_NEGATIVE_FOR_THEMES = 3;
const SOURCE = "sentiment_trend";

type SentimentLabel = "POSITIVE" | "NEUTRAL" | "NEGATIVE";
const VALID_LABELS: readonly SentimentLabel[] = ["POSITIVE", "NEUTRAL", "NEGATIVE"];

type CommentRow = { incoming_message: string; created_at: string };
type ClassifiedComment = { text: string; sentiment: SentimentLabel };

export type SentimentTrendResult = {
  recentNegativeRatio: number;
  previousNegativeRatio: number;
  trend: "improving" | "stable" | "declining";
  topNegativeThemes: string[];
  alert: boolean;
};

function buildClassifyPrompt(texts: string[]): string {
  const numbered = texts.map((t, i) => `${i + 1}. "${t.replace(/"/g, "'").slice(0, 300)}"`).join("\n");
  return `Eres un analista de sentimiento de comentarios reales de redes sociales. Clasifica cada uno de estos ${texts.length} comentarios como exactamente uno de: POSITIVE, NEUTRAL, NEGATIVE.

${numbered}

Responde SOLO con un objeto JSON válido, sin markdown ni backticks, con esta forma exacta (un elemento por comentario, EN EL MISMO ORDEN, exactamente ${texts.length} elementos):
{"sentiments": ["POSITIVE", "NEUTRAL", "NEGATIVE", ...]}`;
}

type ClassifyResult = { sentiments: unknown[]; _meta?: { engine?: string } };

// Clasifica un chunk vía Mistral — si el engine falló o el array no valida (longitud
// distinta, valores fuera de POSITIVE/NEUTRAL/NEGATIVE), devuelve null por cada
// comentario del chunk en vez de asumir un sentimiento que no se clasificó de verdad
// (nunca "NEUTRAL por defecto"): esos comentarios se excluyen más adelante del cálculo.
async function classifyChunk(texts: string[], tenantId: string, saasId: string): Promise<(SentimentLabel | null)[]> {
  const { data } = await defaultLocalModel.generateStructured<ClassifyResult>(
    { prompt: buildClassifyPrompt(texts), tenantId, saasId },
    () => ({ sentiments: [] }) as ClassifyResult,
  );

  if (data._meta?.engine !== "workers-ai" || !Array.isArray(data.sentiments) || data.sentiments.length !== texts.length) {
    return texts.map(() => null);
  }

  return data.sentiments.map((v) => (typeof v === "string" && VALID_LABELS.includes(v as SentimentLabel) ? (v as SentimentLabel) : null));
}

function buildThemesPrompt(negativeTexts: string[]): string {
  const list = negativeTexts.map((t, i) => `${i + 1}. "${t.replace(/"/g, "'").slice(0, 300)}"`).join("\n");
  return `Eres un analista de sentimiento. Estos son comentarios NEGATIVOS reales recibidos por este cliente en redes sociales:

${list}

Identifica hasta 5 temas recurrentes genuinos detrás de estas quejas (nunca inventes un tema que no esté respaldado por los comentarios de arriba). Responde SOLO con un objeto JSON válido, sin markdown ni backticks, con esta forma exacta:
{"themes": ["tema corto en español", ...]}

Si los comentarios son demasiado dispersos para identificar un tema común, responde {"themes": []}.`;
}

type ThemesResult = { themes: unknown[]; _meta?: { engine?: string } };

async function extractNegativeThemes(negativeTexts: string[], tenantId: string, saasId: string): Promise<string[]> {
  if (negativeTexts.length < MIN_NEGATIVE_FOR_THEMES) return [];

  const { data } = await defaultLocalModel.generateStructured<ThemesResult>(
    { prompt: buildThemesPrompt(negativeTexts.slice(0, 30)), tenantId, saasId },
    () => ({ themes: [] }) as ThemesResult,
  );

  if (data._meta?.engine !== "workers-ai" || !Array.isArray(data.themes)) return [];
  return data.themes.filter((t): t is string => typeof t === "string" && t.trim().length > 0).slice(0, 5);
}

function negativeRatioOf(comments: ClassifiedComment[]): number {
  if (!comments.length) return 0;
  return comments.filter((c) => c.sentiment === "NEGATIVE").length / comments.length;
}

function severityFor(recentNegativeRatio: number): IntelligenceFeedPriority | null {
  if (recentNegativeRatio > HIGH_THRESHOLD) return "high";
  if (recentNegativeRatio > MEDIUM_THRESHOLD) return "medium";
  return null;
}

// Analiza la evolución del sentimiento en los comentarios reales del tenant
// (socialflow_conversation_threads, thread_type='COMMENT') y alerta en el Intelligence
// Feed (socialflow_intelligence_feed, vía seedFeedItems/dismissFeedItemsBySource) si el
// ratio de negativos sube por encima de los umbrales. Persiste en
// socialcors_sentiment_trend (tabla propia por tenant, migración 0230) para que otros
// consumidores lean el snapshot ya calculado en vez de re-ejecutar este agente (posts +
// hasta 6 llamadas a Mistral) en cada request.
export class SentimentTrendAgent {
  async run(input: { tenantId: string; saasId: string; accountType?: "influencer" | "empresa" }): Promise<SentimentTrendResult | null> {
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });

    const result = await ctx.socialDb
      .prepare(
        `SELECT incoming_message, created_at
         FROM socialflow_conversation_threads
         WHERE tenant_id = ? AND saas_id = ? AND thread_type = 'COMMENT'
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(input.tenantId, input.saasId, MAX_COMMENTS)
      .all<CommentRow>();

    const comments = (result.results ?? [])
      .map((c) => c.incoming_message?.trim())
      .filter((text): text is string => Boolean(text));

    if (comments.length < MIN_COMMENTS) return null;

    const chunks: string[][] = [];
    for (let i = 0; i < comments.length; i += CHUNK_SIZE) chunks.push(comments.slice(i, i + CHUNK_SIZE));

    const chunkResults = await Promise.all(chunks.map((chunk) => classifyChunk(chunk, input.tenantId, input.saasId)));
    const labels = chunkResults.flat();

    const classified: ClassifiedComment[] = comments
      .map((text, i) => ({ text, sentiment: labels[i] }))
      .filter((c): c is ClassifiedComment => c.sentiment !== null);

    if (classified.length < MIN_COMMENTS) return null;

    const recentWindow = classified.slice(0, Math.min(RECENT_WINDOW, classified.length));
    const previousWindow = classified.slice(recentWindow.length, recentWindow.length + RECENT_WINDOW);

    const recentNegativeRatio = negativeRatioOf(recentWindow);
    const previousNegativeRatio = previousWindow.length ? negativeRatioOf(previousWindow) : recentNegativeRatio;

    const diff = recentNegativeRatio - previousNegativeRatio;
    const trend: SentimentTrendResult["trend"] =
      !previousWindow.length || Math.abs(diff) <= TREND_EPSILON ? "stable" : diff > 0 ? "declining" : "improving";

    const severity = severityFor(recentNegativeRatio);
    const negativeTexts = recentWindow.filter((c) => c.sentiment === "NEGATIVE").map((c) => c.text);
    const topNegativeThemes = await extractNegativeThemes(negativeTexts, input.tenantId, input.saasId);

    const result_: SentimentTrendResult = {
      recentNegativeRatio,
      previousNegativeRatio,
      trend,
      topNegativeThemes,
      alert: severity !== null,
    };

    if (severity) {
      const percent = Math.round(recentNegativeRatio * 100);
      await seedFeedItems(
        input.tenantId,
        [
          {
            type: "alert" as const,
            priority: severity,
            title: severity === "high" ? "Sentimiento muy negativo en tus comentarios" : "Sentimiento negativo en aumento",
            description: topNegativeThemes.length
              ? `${percent}% de tus últimos comentarios son negativos. Temas recurrentes: ${topNegativeThemes.join(", ")}.`
              : `${percent}% de tus últimos comentarios son negativos.`,
            source: SOURCE,
          },
        ],
        input.saasId,
      );
    } else {
      await dismissFeedItemsBySource(input.tenantId, SOURCE, input.saasId);
    }

    const dracoEnv = env();
    if (dracoEnv) {
      await upsertSentimentTrend(input.tenantId, input.saasId, JSON.stringify(result_), classified.length, dracoEnv);
    }

    return result_;
  }
}

// --- Persistencia (tabla propia por tenant, ver migración 0230) -------------------

async function upsertSentimentTrend(
  tenantId: string,
  saasId: string,
  snapshot: string,
  commentCount: number,
  dracoEnv: DracoEnv,
): Promise<void> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return;

  try {
    const now = new Date().toISOString();
    const existing = await db
      .prepare(`SELECT id FROM socialcors_sentiment_trend WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE socialcors_sentiment_trend SET snapshot_json = ?, comment_count = ?, updated_at = ? WHERE id = ?`)
        .bind(snapshot, commentCount, now, existing.id)
        .run();
      return;
    }

    await db
      .prepare(
        `INSERT INTO socialcors_sentiment_trend (id, tenant_id, saas_id, snapshot_json, comment_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), tenantId, saasId, snapshot, commentCount, now, now)
      .run();
  } catch (err) {
    console.error("[SentimentTrendAgent] upsertSentimentTrend failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
  }
}

// Lectura barata para futuros consumidores — nunca vuelve a leer comentarios ni a
// llamar a Mistral, solo el snapshot que ya calculó el cron diario.
export async function getLatestSentimentTrend(
  tenantId: string,
  saasId: string,
  dracoEnv: DracoEnv,
): Promise<SentimentTrendResult | null> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return null;

  try {
    const row = await db
      .prepare(`SELECT snapshot_json FROM socialcors_sentiment_trend WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ snapshot_json: string }>();

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as SentimentTrendResult;
  } catch (err) {
    console.error("[SentimentTrendAgent] getLatestSentimentTrend failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return null;
  }
}
