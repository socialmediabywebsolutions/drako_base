import { defaultLocalModel } from "../models/localModel";
import { listSaasSocialPosts, listSaasSocialMetricsForPost, resolveSocialContext } from "@/lib/socialflow/repository";
import { env, type DracoEnv } from "@/lib/cf";
import type { SaasSocialPost } from "@/lib/social-core/types";

const MAX_POSTS_ANALYZED = 60;
const MIN_POSTS_WITH_METRICS = 10;
const MAX_BEST_DAYS = 3;
const SEQUENCE_LENGTH = 3;

const WEEKDAY_NAMES_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export type PostingScheduleResult = {
  bestDays: string[];
  optimalGapDays: number;
  bestFormatSequence: string[];
  insight: string;
  weeklyScheduleRecommendation: string;
};

type PostWithScore = {
  post: SaasSocialPost;
  score: number;
  postedAtMs: number;
};

type GapBucket = "0-1" | "2" | "3+";

const GAP_BUCKET_TO_DAYS: Record<GapBucket, number> = { "0-1": 1, "2": 2, "3+": 3 };

function computeEngagementScore(m: { likes: number; comments: number; shares: number; saved: number }): number {
  return m.saved * 3 + m.comments * 2 + m.likes + m.shares;
}

function gapBucketOf(gapDays: number): GapBucket {
  if (gapDays <= 1) return "0-1";
  if (gapDays === 2) return "2";
  return "3+";
}

// Moda (valor más frecuente) — empate: gana el primero en aparecer.
function mostCommon<T>(values: T[]): T | null {
  if (!values.length) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T = values[0];
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

// Engagement medio real por día de la semana (de los propios posts del tenant) —
// devuelve los mejores días ordenados de mayor a menor, hasta MAX_BEST_DAYS.
function computeBestDays(posts: PostWithScore[]): string[] {
  const byDay = new Map<number, { total: number; count: number }>();
  for (const p of posts) {
    const day = new Date(p.postedAtMs).getUTCDay();
    const bucket = byDay.get(day) ?? { total: 0, count: 0 };
    bucket.total += p.score;
    bucket.count += 1;
    byDay.set(day, bucket);
  }

  return Array.from(byDay.entries())
    .map(([day, { total, count }]) => ({ day, avg: total / count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, MAX_BEST_DAYS)
    .map(({ day }) => WEEKDAY_NAMES_ES[day]);
}

// Agrupa posts consecutivos (ordenados por fecha real de publicación) por el gap en
// días desde el post anterior, y compara el engagement medio del post que llega
// DESPUÉS de cada gap — responde "¿qué pasa cuando publica seguido vs. con descanso?".
function computeOptimalGapDays(sorted: PostWithScore[]): number {
  const buckets = new Map<GapBucket, { total: number; count: number }>();

  for (let i = 1; i < sorted.length; i++) {
    const gapDays = Math.round((sorted[i].postedAtMs - sorted[i - 1].postedAtMs) / 86_400_000);
    if (gapDays < 0) continue;
    const bucket = gapBucketOf(gapDays);
    const entry = buckets.get(bucket) ?? { total: 0, count: 0 };
    entry.total += sorted[i].score;
    entry.count += 1;
    buckets.set(bucket, entry);
  }

  let best: { bucket: GapBucket; avg: number } | null = null;
  for (const [bucket, { total, count }] of buckets) {
    const avg = total / count;
    if (!best || avg > best.avg) best = { bucket, avg };
  }

  return best ? GAP_BUCKET_TO_DAYS[best.bucket] : 2;
}

// Bigrama formato-anterior -> formato-actual -> engagement medio del post ACTUAL —
// responde "¿hay un orden de formatos que funciona mejor?". Camino greedy de
// SEQUENCE_LENGTH pasos partiendo del formato más publicado; si no hay dato de bigrama
// para un paso, repite el formato más publicado (nunca inventa un salto sin evidencia).
function computeBestFormatSequence(sorted: PostWithScore[]): string[] {
  const bigram = new Map<string, Map<string, { total: number; count: number }>>();
  for (let i = 1; i < sorted.length; i++) {
    const prevFormat = sorted[i - 1].post.contentType;
    const currFormat = sorted[i].post.contentType;
    const nextMap = bigram.get(prevFormat) ?? new Map<string, { total: number; count: number }>();
    const entry = nextMap.get(currFormat) ?? { total: 0, count: 0 };
    entry.total += sorted[i].score;
    entry.count += 1;
    nextMap.set(currFormat, entry);
    bigram.set(prevFormat, nextMap);
  }

  const overallFormat = mostCommon(sorted.map((p) => p.post.contentType));
  if (!overallFormat) return [];

  const sequence: string[] = [overallFormat];
  let current: string = overallFormat;
  for (let step = 1; step < SEQUENCE_LENGTH; step++) {
    const nextMap = bigram.get(current);
    const bestNext = nextMap
      ? Array.from(nextMap.entries()).map(([format, { total, count }]) => ({ format, avg: total / count })).sort((a, b) => b.avg - a.avg)[0]
      : null;
    current = bestNext?.format ?? overallFormat;
    sequence.push(current);
  }

  return sequence;
}

function buildPrompt(input: { bestDays: string[]; optimalGapDays: number; bestFormatSequence: string[]; postCount: number }): string {
  return `Eres un estratega de ritmo de publicación en redes sociales. Estos son patrones REALES detectados en los últimos ${input.postCount} posts publicados de este cliente (nunca inventes datos que no estén aquí):

- Días de la semana con mejor engagement medio: ${input.bestDays.join(", ") || "(sin patrón claro)"}
- Separación entre posts que mejor funciona: ${input.optimalGapDays} día(s) de descanso antes del siguiente post
- Secuencia de formatos con mejor rendimiento acumulado: ${input.bestFormatSequence.join(" → ") || "(sin patrón claro)"}

Responde SOLO con un objeto JSON válido, sin markdown ni backticks, con esta forma exacta:
{
  "insight": "2-3 frases en español explicando por qué este ritmo funciona para este cliente, citando solo los datos de arriba",
  "weeklyScheduleRecommendation": "1-2 frases en español, accionables, proponiendo un calendario semanal concreto con esos días y ese orden de formatos"
}`;
}

function buildFallbackInsight(bestDays: string[], optimalGapDays: number): string {
  if (!bestDays.length) return "Todavía no hay suficientes posts para detectar un patrón de ritmo claro — sigue publicando de forma consistente.";
  return `Tus posts publicados en ${bestDays.join(" y ")} tienen mejor engagement medio, y dejar ${optimalGapDays} día(s) de descanso entre posts es lo que mejor te ha funcionado hasta ahora.`;
}

function buildFallbackRecommendation(bestDays: string[], bestFormatSequence: string[]): string {
  if (!bestDays.length || !bestFormatSequence.length) return "Sigue publicando de forma consistente para que el Cerebro pueda detectar tu ritmo óptimo.";
  return `Prueba armar tu semana alrededor de ${bestDays.join(", ")}, siguiendo el orden ${bestFormatSequence.join(" → ")}.`;
}

type ScheduleLLMResult = { insight: string; weeklyScheduleRecommendation: string; _meta?: { engine?: string } };

// Aprende el RITMO óptimo de publicación por tenant (días de la semana, separación
// entre posts, orden de formatos) — complementario a BestTimeToPostAgent, que calcula
// la HORA óptima por formato. Usa postedAt (fecha real de publicación), nunca
// scheduled_at: ese campo es el objetivo pre-publicación y puede quedar obsoleto o nulo
// una vez el post ya está POSTED (mismo criterio que BestTimeToPostAgent/
// ContentPerformanceAgent). Persiste en socialcors_posting_schedule (tabla propia por
// tenant, migración 0229) para que el chat y SocialFlowOrchestrator lean el snapshot ya
// calculado en vez de re-ejecutar este agente (posts + métricas + LLM) en cada request.
export class OptimalPostingScheduleAgent {
  async run(input: { tenantId: string; saasId: string; accountType?: "influencer" | "empresa" }): Promise<PostingScheduleResult | null> {
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const allPosts = await listSaasSocialPosts(ctx);

    const published = allPosts
      .filter((post) => post.status === "POSTED" || post.status === "PUBLISHED")
      .filter((post) => Boolean(post.postedAt))
      .sort((a, b) => new Date(a.postedAt as string).getTime() - new Date(b.postedAt as string).getTime())
      .slice(-MAX_POSTS_ANALYZED);

    const withMetrics = await Promise.all(
      published.map(async (post): Promise<PostWithScore | null> => {
        const metrics = await listSaasSocialMetricsForPost(ctx, post.id).catch(() => []);
        const latest = metrics[0] ?? null;
        if (!latest) return null;
        const saved = typeof latest.metadata?.saved === "number" ? latest.metadata.saved : 0;
        const score = computeEngagementScore({ likes: latest.likes, comments: latest.comments, shares: latest.shares, saved });
        return { post, score, postedAtMs: new Date(post.postedAt as string).getTime() };
      }),
    );
    const sorted = withMetrics
      .filter((x): x is PostWithScore => x !== null)
      .sort((a, b) => a.postedAtMs - b.postedAtMs);

    if (sorted.length < MIN_POSTS_WITH_METRICS) return null;

    const bestDays = computeBestDays(sorted);
    const optimalGapDays = computeOptimalGapDays(sorted);
    const bestFormatSequence = computeBestFormatSequence(sorted);

    const fallback = {
      insight: buildFallbackInsight(bestDays, optimalGapDays),
      weeklyScheduleRecommendation: buildFallbackRecommendation(bestDays, bestFormatSequence),
    };

    const { data } = await defaultLocalModel.generateStructured<ScheduleLLMResult>(
      {
        prompt: buildPrompt({ bestDays, optimalGapDays, bestFormatSequence, postCount: sorted.length }),
        tenantId: input.tenantId,
        saasId: input.saasId,
      },
      () => fallback as ScheduleLLMResult,
    );

    const usable =
      data._meta?.engine === "workers-ai" &&
      typeof data.insight === "string" && data.insight.trim() &&
      typeof data.weeklyScheduleRecommendation === "string" && data.weeklyScheduleRecommendation.trim();

    const result: PostingScheduleResult = {
      bestDays,
      optimalGapDays,
      bestFormatSequence,
      insight: usable ? data.insight.trim() : fallback.insight,
      weeklyScheduleRecommendation: usable ? data.weeklyScheduleRecommendation.trim() : fallback.weeklyScheduleRecommendation,
    };

    const dracoEnv = env();
    if (dracoEnv) {
      await upsertPostingSchedule(input.tenantId, input.saasId, JSON.stringify(result), sorted.length, dracoEnv);
    }

    return result;
  }
}

// --- Persistencia (tabla propia por tenant, ver migración 0229) -------------------

async function upsertPostingSchedule(
  tenantId: string,
  saasId: string,
  snapshot: string,
  postCount: number,
  dracoEnv: DracoEnv,
): Promise<void> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return;

  try {
    const now = new Date().toISOString();
    const existing = await db
      .prepare(`SELECT id FROM socialcors_posting_schedule WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE socialcors_posting_schedule SET snapshot_json = ?, post_count = ?, updated_at = ? WHERE id = ?`)
        .bind(snapshot, postCount, now, existing.id)
        .run();
      return;
    }

    await db
      .prepare(
        `INSERT INTO socialcors_posting_schedule (id, tenant_id, saas_id, snapshot_json, post_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), tenantId, saasId, snapshot, postCount, now, now)
      .run();
  } catch (err) {
    console.error("[OptimalPostingScheduleAgent] upsertPostingSchedule failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
  }
}

// Lectura barata para el chat/SocialFlowOrchestrator — nunca vuelve a leer posts ni a
// llamar a Mistral, solo el snapshot que ya calculó el cron diario.
export async function getLatestOptimalPostingSchedule(
  tenantId: string,
  saasId: string,
  dracoEnv: DracoEnv,
): Promise<PostingScheduleResult | null> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return null;

  try {
    const row = await db
      .prepare(`SELECT snapshot_json FROM socialcors_posting_schedule WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ snapshot_json: string }>();

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as PostingScheduleResult;
  } catch (err) {
    console.error("[OptimalPostingScheduleAgent] getLatestOptimalPostingSchedule failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// bestDays (nombres de día en español) -> números de día ISO (1=lunes ... 7=domingo) —
// usado por SocialFlowOrchestrator para pasarle preferredWeekdays a SchedulerAgent.
export function mapBestDaysToIsoWeekdays(bestDays: string[]): number[] {
  return bestDays
    .map((name) => WEEKDAY_NAMES_ES.indexOf(name))
    .filter((day) => day >= 0)
    .map((day) => (day === 0 ? 7 : day));
}
