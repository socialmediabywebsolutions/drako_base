import { defaultLocalModel } from "../models/localModel";
import { listSaasSocialPosts, listSaasSocialMetricsForPost, resolveSocialContext } from "@/lib/socialflow/repository";
import { env, type DracoEnv } from "@/lib/cf";
import type { SaasSocialPost } from "@/lib/social-core/types";
import { classifyHook } from "./contentHeuristics";

const MAX_POSTS_ANALYZED = 30;
const MIN_POSTS_WITH_METRICS = 5;
const TOP_N = 3;
const MAX_SNAPSHOTS_PER_TENANT = 12;

export type ContentPerformanceTopPost = {
  hook: string;
  contentType: string;
  score: number;
  postedAt: string;
};

export type ContentPerformancePatterns = {
  bestFormat: string | null;
  bestHour: number | null;
  bestHookType: string | null;
};

export type ContentPerformanceResult = {
  topPosts: ContentPerformanceTopPost[];
  insight: string;
  patterns: ContentPerformancePatterns;
};

type PostWithScore = {
  post: SaasSocialPost;
  score: number;
  reach: number;
  saved: number;
};

// Primeras ~8 palabras de la primera línea del caption — mismo criterio de longitud
// que el título derivado en generate-from-image/route.ts, pero por palabras en vez de
// caracteres para no cortar una palabra a la mitad.
function extractHookWords(body: string): string {
  const firstLine = body.split("\n")[0]?.trim() ?? "";
  const words = firstLine.split(/\s+/).filter(Boolean);
  return words.slice(0, 8).join(" ");
}

function computeEngagementScore(m: { likes: number; comments: number; shares: number; saved: number }): number {
  return m.saved * 3 + m.comments * 2 + m.likes + m.shares;
}

// Moda (valor más frecuente) — usado para bestFormat/bestHookType. Empate: gana el
// primero en aparecer (Array.from(Map) conserva orden de inserción), consistente con
// "top posts ordenados por score" ya que estos vienen de esa misma lista.
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

function buildInsightPrompt(topPosts: ContentPerformanceTopPost[]): string {
  const postsBlock = topPosts
    .map(
      (p, i) =>
        `${i + 1}. Hook: "${p.hook}" — Formato: ${p.contentType} — Hora UTC: ${new Date(p.postedAt).getUTCHours()}h — Score de engagement: ${p.score}`,
    )
    .join("\n");

  return `Eres un analista de contenido. Estos son los 3 posts con mejor rendimiento real de este cliente en Instagram (nunca inventes datos que no estén aquí):

${postsBlock}

¿Por qué crees que este contenido funcionó mejor? ¿Qué patrón común hay entre los 3? Responde en 2-3 frases accionables, en español, citando solo lo que ves arriba (hooks, formato, horario) — sin inventar métricas ni razones que no puedas justificar con estos datos.`;
}

function buildFallbackInsight(topPosts: ContentPerformanceTopPost[], patterns: ContentPerformancePatterns): string {
  const parts: string[] = [];
  if (patterns.bestFormat) parts.push(`el formato ${patterns.bestFormat}`);
  if (patterns.bestHookType) parts.push(`hooks de tipo "${patterns.bestHookType}"`);
  if (patterns.bestHour !== null) parts.push(`publicar cerca de las ${patterns.bestHour}h UTC`);
  if (!parts.length) return `Tus ${topPosts.length} posts con mejor rendimiento no comparten un patrón claro todavía — sigue variando formato y horario.`;
  return `Tus posts con mejor rendimiento comparten ${parts.join(", ")}.`;
}

type InsightResult = { insight: string; _meta?: { engine?: string } };

// Análisis de los propios posts publicados del tenant: identifica los 3 con mejor
// engagement compuesto (saved×3 + comments×2 + likes + shares — saved/comments indican
// más intención real que un like) y le pide a Mistral una hipótesis de por qué
// funcionaron. Persiste en socialcors_performance_snapshots (tabla propia — nunca
// socialcors_style_history, ver migración 0225) para que el chat lea el snapshot ya
// calculado en vez de re-ejecutar este agente (caro: posts + métricas + LLM) en cada
// mensaje.
export class ContentPerformanceAgent {
  async run(input: { tenantId: string; saasId: string; accountType?: "influencer" | "empresa" }): Promise<ContentPerformanceResult | null> {
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const allPosts = await listSaasSocialPosts(ctx);

    const published = allPosts
      .filter((post) => post.status === "POSTED" || post.status === "PUBLISHED")
      .sort((a, b) =>
        new Date(b.postedAt ?? b.scheduledAt ?? b.createdAt).getTime()
        - new Date(a.postedAt ?? a.scheduledAt ?? a.createdAt).getTime(),
      )
      .slice(0, MAX_POSTS_ANALYZED);

    const withMetrics = await Promise.all(
      published.map(async (post): Promise<PostWithScore | null> => {
        const metrics = await listSaasSocialMetricsForPost(ctx, post.id).catch(() => []);
        const latest = metrics[0] ?? null;
        if (!latest) return null;
        // reach/saved viven hoy en metadata (JSON), no en las columnas propias que
        // añadió la migración 0223 — ningún lector existente las expone todavía (ver
        // refreshSocialPostLiveAnalytics en repository.ts, mismo criterio).
        const reach = typeof latest.metadata?.reach === "number" ? latest.metadata.reach : 0;
        const saved = typeof latest.metadata?.saved === "number" ? latest.metadata.saved : 0;
        const score = computeEngagementScore({ likes: latest.likes, comments: latest.comments, shares: latest.shares, saved });
        return { post, score, reach, saved };
      }),
    );
    const withRealMetrics = withMetrics.filter((x): x is PostWithScore => x !== null);

    if (withRealMetrics.length < MIN_POSTS_WITH_METRICS) return null;

    const top = [...withRealMetrics].sort((a, b) => b.score - a.score).slice(0, TOP_N);

    const topPosts: ContentPerformanceTopPost[] = top.map(({ post, score }) => ({
      hook: extractHookWords(post.body),
      contentType: post.contentType,
      score,
      postedAt: post.postedAt ?? post.scheduledAt ?? post.createdAt,
    }));

    const patterns: ContentPerformancePatterns = {
      bestFormat: mostCommon(topPosts.map((p) => p.contentType)),
      bestHour: mostCommon(topPosts.map((p) => new Date(p.postedAt).getUTCHours())),
      bestHookType: mostCommon(top.map(({ post }) => classifyHook(post.body.split("\n")[0] ?? ""))),
    };

    const { data } = await defaultLocalModel.generateStructured<InsightResult>(
      { prompt: buildInsightPrompt(topPosts), tenantId: input.tenantId, saasId: input.saasId },
      () => ({ insight: "" }),
    );
    const insight =
      data._meta?.engine === "workers-ai" && typeof data.insight === "string" && data.insight.trim()
        ? data.insight.trim()
        : buildFallbackInsight(topPosts, patterns);

    const result: ContentPerformanceResult = { topPosts, insight, patterns };

    const dracoEnv = env();
    if (dracoEnv) {
      await savePerformanceSnapshot(input.tenantId, input.saasId, JSON.stringify(result), withRealMetrics.length, dracoEnv);
    }

    return result;
  }
}

// --- Persistencia (tabla propia, ver migración 0225) ------------------------------

type PerformanceSnapshotRow = { id: string; snapshot_json: string; post_count: number; created_at: string };

export type PerformanceSnapshot = { snapshotJson: string; postCount: number; createdAt: string };

// Append + poda a las MAX_SNAPSHOTS_PER_TENANT más recientes — mismo mecanismo que
// saveStyleSnapshot (NicheIntelligenceService.ts), pero contra
// socialcors_performance_snapshots, nunca socialcors_style_history.
export async function savePerformanceSnapshot(
  tenantId: string,
  saasId: string,
  snapshot: string,
  postCount: number,
  dracoEnv: DracoEnv,
): Promise<void> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return;

  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO socialcors_performance_snapshots (id, tenant_id, saas_id, snapshot_json, post_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, tenantId, saasId, snapshot, postCount, now)
      .run();

    await db
      .prepare(
        `DELETE FROM socialcors_performance_snapshots
         WHERE tenant_id = ? AND saas_id = ?
         AND id NOT IN (
           SELECT id FROM socialcors_performance_snapshots
           WHERE tenant_id = ? AND saas_id = ?
           ORDER BY created_at DESC
           LIMIT ?
         )`,
      )
      .bind(tenantId, saasId, tenantId, saasId, MAX_SNAPSHOTS_PER_TENANT)
      .run();
  } catch (err) {
    console.error("[ContentPerformanceAgent] savePerformanceSnapshot failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
  }
}

// Snapshot más reciente para un tenant — lectura barata que usa el chat en vez de
// re-ejecutar ContentPerformanceAgent.run() (posts + métricas + llamada a Mistral) en
// cada mensaje.
export async function getLatestPerformanceSnapshot(
  tenantId: string,
  saasId: string,
  dracoEnv: DracoEnv,
): Promise<PerformanceSnapshot | null> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return null;

  try {
    const row = await db
      .prepare(
        `SELECT id, snapshot_json, post_count, created_at
         FROM socialcors_performance_snapshots
         WHERE tenant_id = ? AND saas_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .bind(tenantId, saasId)
      .first<PerformanceSnapshotRow>();

    if (!row) return null;
    return { snapshotJson: row.snapshot_json, postCount: row.post_count, createdAt: row.created_at };
  } catch (err) {
    console.error("[ContentPerformanceAgent] getLatestPerformanceSnapshot failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return null;
  }
}
