import { defaultLocalModel } from "../models/localModel";
import { listSaasSocialPosts, listSaasSocialMetricsForPost, resolveSocialContext } from "@/lib/socialflow/repository";
import { env, type DracoEnv } from "@/lib/cf";
import type { SaasSocialPost } from "@/lib/social-core/types";
import { classifyHook } from "./contentHeuristics";

const MAX_POSTS_ANALYZED = 30;
const MIN_POSTS_WITH_METRICS = 5;
const GROWTH_RATIO_THRESHOLD = 3;
const TOP_N = 5;

export type AudienceGrowthPost = {
  id: string;
  contentType: string;
  hook: string;
  ratio: number;
};

export type AudienceLoyaltyPost = {
  id: string;
  contentType: string;
  hook: string;
};

export type AudienceGrowthResult = {
  growthPosts: AudienceGrowthPost[];
  loyaltyPosts: AudienceLoyaltyPost[];
  insight: string;
  recommendation: string;
};

type PostWithMetrics = {
  post: SaasSocialPost;
  reach: number;
  likes: number;
  saved: number;
  comments: number;
};

type CategoryPatterns = {
  bestFormat: string | null;
  bestHookType: string | null;
  bestHour: number | null;
};

// Primeras ~8 palabras de la primera línea del caption — mismo criterio que
// ContentPerformanceAgent (no se puede importar la de allí: no está exportada).
function extractHookWords(body: string): string {
  const firstLine = body.split("\n")[0]?.trim() ?? "";
  const words = firstLine.split(/\s+/).filter(Boolean);
  return words.slice(0, 8).join(" ");
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

function computePatterns(posts: PostWithMetrics[]): CategoryPatterns {
  if (!posts.length) return { bestFormat: null, bestHookType: null, bestHour: null };
  return {
    bestFormat: mostCommon(posts.map((p) => p.post.contentType)),
    bestHookType: mostCommon(posts.map((p) => classifyHook(p.post.body.split("\n")[0] ?? ""))),
    bestHour: mostCommon(
      posts.map((p) => new Date(p.post.postedAt ?? p.post.scheduledAt ?? p.post.createdAt).getUTCHours()),
    ),
  };
}

function buildPrompt(input: {
  growth: PostWithMetrics[];
  loyalty: PostWithMetrics[];
  growthPatterns: CategoryPatterns;
  loyaltyPatterns: CategoryPatterns;
}): string {
  const growthBlock = input.growth
    .map((p, i) => {
      const ratio = (p.reach / Math.max(p.likes, 1)).toFixed(1);
      return `${i + 1}. Hook: "${extractHookWords(p.post.body)}" — Formato: ${p.post.contentType} — Reach/Likes: ${ratio}x — Hora UTC: ${new Date(p.post.postedAt ?? p.post.scheduledAt ?? p.post.createdAt).getUTCHours()}h`;
    })
    .join("\n");
  const loyaltyBlock = input.loyalty
    .map((p, i) => {
      return `${i + 1}. Hook: "${extractHookWords(p.post.body)}" — Formato: ${p.post.contentType} — Saved+Comments: ${p.saved + p.comments} — Hora UTC: ${new Date(p.post.postedAt ?? p.post.scheduledAt ?? p.post.createdAt).getUTCHours()}h`;
    })
    .join("\n");

  return `Eres un analista de crecimiento de audiencia en redes sociales. Tienes datos REALES de los posts de este cliente (nunca inventes cifras que no estén aquí), clasificados en dos grupos:

GRUPO 1 — "Atraen audiencia nueva" (mucho reach relativo a likes: los vio gente que todavía no lo sigue):
${growthBlock || "(sin posts suficientes en este grupo)"}

GRUPO 2 — "Fidelizan audiencia existente" (saved+comments por encima de su media: audiencia ya comprometida):
${loyaltyBlock || "(sin posts suficientes en este grupo)"}

¿Qué patrón de formato, hook, tema u horario caracteriza a cada grupo? ¿Qué debería hacer este cliente para atraer más audiencia nueva sin dejar de fidelizar a la que ya tiene?

Responde SOLO con un objeto JSON válido, sin markdown ni backticks, con esta forma exacta:
{
  "insight": "2-3 frases en español sobre qué diferencia a ambos grupos, citando solo los datos de arriba",
  "recommendation": "1-2 frases en español, accionables, sobre qué publicar para seguir creciendo"
}`;
}

function buildFallbackInsight(growthPatterns: CategoryPatterns, loyaltyPatterns: CategoryPatterns): string {
  const parts: string[] = [];
  if (growthPatterns.bestFormat) parts.push(`tus posts que más atraen audiencia nueva suelen ser ${growthPatterns.bestFormat}`);
  if (loyaltyPatterns.bestFormat) parts.push(`los que más fidelizan suelen ser ${loyaltyPatterns.bestFormat}`);
  if (!parts.length) return "Todavía no hay un patrón claro entre lo que te trae audiencia nueva y lo que fideliza a la que ya tienes — sigue variando formato y horario.";
  return `Por ahora, ${parts.join("; ")}.`;
}

function buildFallbackRecommendation(growthPatterns: CategoryPatterns): string {
  if (growthPatterns.bestFormat && growthPatterns.bestHour !== null) {
    return `Prueba publicar más contenido tipo ${growthPatterns.bestFormat} cerca de las ${growthPatterns.bestHour}h UTC — es el patrón que más te ha traído audiencia nueva hasta ahora.`;
  }
  if (growthPatterns.bestFormat) {
    return `Prueba publicar más contenido tipo ${growthPatterns.bestFormat} — es el patrón que más te ha traído audiencia nueva hasta ahora.`;
  }
  return "Sigue publicando de forma consistente para que el Cerebro pueda detectar qué te trae audiencia nueva.";
}

type GrowthLLMResult = { insight: string; recommendation: string; _meta?: { engine?: string } };

// Clasifica los posts publicados del tenant en dos grupos no excluyentes según sus
// métricas reales (nunca según un historial de seguidores: saas_social_accounts no
// tiene followers_count, y socialflow_social_metrics_snapshots tiene
// UNIQUE(tenant_id, saas_id, provider) — solo puede existir UN snapshot por proveedor,
// así que un historial de seguidores real es estructuralmente imposible de leer):
// - "Atrae audiencia nueva": reach alto relativo a likes (ratio > 3) — mucha gente lo
//   vio que probablemente no lo sigue todavía.
// - "Fideliza audiencia existente": saved+comments por encima de la media del tenant —
//   señal de audiencia ya comprometida.
// Persiste en socialcors_audience_growth (tabla propia por tenant, migración 0228) para
// que el chat lea el snapshot ya calculado en vez de re-ejecutar este agente (posts +
// métricas + LLM) en cada mensaje.
export class AudienceGrowthAgent {
  async run(input: { tenantId: string; saasId: string; accountType?: "influencer" | "empresa" }): Promise<AudienceGrowthResult | null> {
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
      published.map(async (post): Promise<PostWithMetrics | null> => {
        const metrics = await listSaasSocialMetricsForPost(ctx, post.id).catch(() => []);
        const latest = metrics[0] ?? null;
        if (!latest) return null;
        // reach/saved viven en metadata (JSON) — igual que ContentPerformanceAgent, ver
        // migración 0223.
        const reach = typeof latest.metadata?.reach === "number" ? latest.metadata.reach : 0;
        const saved = typeof latest.metadata?.saved === "number" ? latest.metadata.saved : 0;
        return { post, reach, saved, likes: latest.likes, comments: latest.comments };
      }),
    );
    const withRealMetrics = withMetrics.filter((x): x is PostWithMetrics => x !== null);

    if (withRealMetrics.length < MIN_POSTS_WITH_METRICS) return null;

    const avgLoyaltyScore =
      withRealMetrics.reduce((sum, p) => sum + p.saved + p.comments, 0) / withRealMetrics.length;

    const growthCandidates = withRealMetrics
      .filter((p) => p.reach > 0 && p.reach / Math.max(p.likes, 1) > GROWTH_RATIO_THRESHOLD)
      .sort((a, b) => b.reach / Math.max(b.likes, 1) - a.reach / Math.max(a.likes, 1))
      .slice(0, TOP_N);

    const loyaltyCandidates = withRealMetrics
      .filter((p) => p.saved + p.comments > avgLoyaltyScore && p.saved + p.comments > 0)
      .sort((a, b) => b.saved + b.comments - (a.saved + a.comments))
      .slice(0, TOP_N);

    const growthPosts: AudienceGrowthPost[] = growthCandidates.map((p) => ({
      id: p.post.id,
      contentType: p.post.contentType,
      hook: extractHookWords(p.post.body),
      ratio: Number((p.reach / Math.max(p.likes, 1)).toFixed(1)),
    }));
    const loyaltyPosts: AudienceLoyaltyPost[] = loyaltyCandidates.map((p) => ({
      id: p.post.id,
      contentType: p.post.contentType,
      hook: extractHookWords(p.post.body),
    }));

    const growthPatterns = computePatterns(growthCandidates);
    const loyaltyPatterns = computePatterns(loyaltyCandidates);

    const fallback = {
      insight: buildFallbackInsight(growthPatterns, loyaltyPatterns),
      recommendation: buildFallbackRecommendation(growthPatterns),
    };

    const { data } = await defaultLocalModel.generateStructured<GrowthLLMResult>(
      {
        prompt: buildPrompt({ growth: growthCandidates, loyalty: loyaltyCandidates, growthPatterns, loyaltyPatterns }),
        tenantId: input.tenantId,
        saasId: input.saasId,
      },
      () => fallback as GrowthLLMResult,
    );

    const usable =
      data._meta?.engine === "workers-ai" &&
      typeof data.insight === "string" && data.insight.trim() &&
      typeof data.recommendation === "string" && data.recommendation.trim();

    const result: AudienceGrowthResult = {
      growthPosts,
      loyaltyPosts,
      insight: usable ? data.insight.trim() : fallback.insight,
      recommendation: usable ? data.recommendation.trim() : fallback.recommendation,
    };

    const dracoEnv = env();
    if (dracoEnv) {
      await upsertAudienceGrowth(input.tenantId, input.saasId, JSON.stringify(result), withRealMetrics.length, dracoEnv);
    }

    return result;
  }
}

// --- Persistencia (tabla propia por tenant, ver migración 0228) -------------------

async function upsertAudienceGrowth(
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
      .prepare(`SELECT id FROM socialcors_audience_growth WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE socialcors_audience_growth SET snapshot_json = ?, post_count = ?, updated_at = ? WHERE id = ?`)
        .bind(snapshot, postCount, now, existing.id)
        .run();
      return;
    }

    await db
      .prepare(
        `INSERT INTO socialcors_audience_growth (id, tenant_id, saas_id, snapshot_json, post_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), tenantId, saasId, snapshot, postCount, now, now)
      .run();
  } catch (err) {
    console.error("[AudienceGrowthAgent] upsertAudienceGrowth failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
  }
}

// Lectura barata para el chat — nunca vuelve a leer posts/métricas ni a llamar a
// Mistral, solo el snapshot que ya calculó el cron diario.
export async function getLatestAudienceGrowth(
  tenantId: string,
  saasId: string,
  dracoEnv: DracoEnv,
): Promise<AudienceGrowthResult | null> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return null;

  try {
    const row = await db
      .prepare(`SELECT snapshot_json FROM socialcors_audience_growth WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ snapshot_json: string }>();

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as AudienceGrowthResult;
  } catch (err) {
    console.error("[AudienceGrowthAgent] getLatestAudienceGrowth failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return null;
  }
}
