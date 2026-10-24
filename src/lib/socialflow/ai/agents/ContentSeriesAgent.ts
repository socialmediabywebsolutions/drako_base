import { defaultLocalModel } from "../models/localModel";
import { listSaasSocialPosts, listSaasSocialMetricsForPost, resolveSocialContext } from "@/lib/socialflow/repository";
import { env, type DracoEnv } from "@/lib/cf";
import { seedFeedItems, dismissFeedItemsBySource } from "@/lib/socialflow/intelligence/repository";
import type { SaasSocialPost } from "@/lib/social-core/types";
import { extractHashtags } from "./contentHeuristics";

const LOOKBACK_DAYS = 14;
const COVERAGE_LOOKBACK_DAYS = 30;
const MIN_POSTS_WITH_METRICS = 5;
const MOMENTUM_MULTIPLIER = 1.5;
const MAX_MOMENTUM_POSTS = 5;
const SOURCE_PREFIX = "content_series";

type PostWithScore = { post: SaasSocialPost; score: number };

type FollowupFormat = "reel" | "carrusel" | "post";
const VALID_FORMATS: readonly FollowupFormat[] = ["reel", "carrusel", "post"];

export type SeriesFollowup = { hook: string; format: FollowupFormat; reason: string };
export type SeriesOpportunity = {
  originalPost: { id: string; hook: string; score: number };
  suggestedFollowups: SeriesFollowup[];
};

export type ContentSeriesResult = {
  seriesOpportunities: SeriesOpportunity[];
  totalOpportunities: number;
};

function computeEngagementScore(m: { likes: number; comments: number; shares: number; saved: number }): number {
  return m.saved * 3 + m.comments * 2 + m.likes + m.shares;
}

// Primeras ~8 palabras de la primera línea del caption — mismo criterio que
// ContentPerformanceAgent/AudienceGrowthAgent (no exportado allí, copia local).
function extractHookWords(body: string): string {
  const firstLine = body.split("\n")[0]?.trim() ?? "";
  const words = firstLine.split(/\s+/).filter(Boolean);
  return words.slice(0, 8).join(" ");
}

function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const STOPWORDS = new Set([
  "que", "qué", "como", "cómo", "cuando", "cuándo", "donde", "dónde", "cuanto", "cuánto",
  "para", "esto", "esta", "estos", "estas", "pero", "porque", "todo", "toda", "todos",
  "todas", "muy", "mas", "más", "mucho", "poco", "sobre", "entre", "hasta", "desde", "cada",
  "otro", "otra", "otros", "otras", "eres", "sido", "hace", "hacer", "quiere", "quieres",
  "tiene", "tienen", "vamos", "solo", "sino", "aqui", "así", "nunca", "siempre", "nadie",
  "algo", "alguien", "también", "tambien", "una", "unos", "unas", "los", "las", "del", "con",
]);

function extractSignificantWords(text: string): string[] {
  const normalized = normalizeText(text).replace(/[¿?¡!.,;:"'()]/g, " ");
  const words = normalized.match(/[a-z]{3,}/g) ?? [];
  return words.filter((w) => !STOPWORDS.has(w)).slice(0, 6);
}

// Heurística barata (mismo criterio que hasTenantAlreadyCoveredTopic en
// ViralMomentAgent): ¿el cliente ya publicó sobre este ángulo sugerido? Se considera
// cubierto si al menos la mitad de las palabras significativas del hook aparecen en su
// propio corpus de posts publicados recientes — no exige coincidencia exacta.
function isAlreadyCovered(hook: string, publishedCorpus: string): boolean {
  const words = extractSignificantWords(hook);
  if (!words.length) return false;
  const matched = words.filter((w) => publishedCorpus.includes(w));
  return matched.length / words.length >= 0.5;
}

function buildFollowupPrompt(input: { hook: string; contentType: string; hashtags: string[]; score: number; avgScore: number }): string {
  return `Eres un estratega de contenido. Este post real de este cliente tuvo un rendimiento muy por encima de su media (score de engagement ${input.score} vs. media del período ${Math.round(input.avgScore)}):

Hook: "${input.hook}"
Formato: ${input.contentType}
Hashtags: ${input.hashtags.join(" ") || "(ninguno)"}

Genera 3-4 ideas de posts de SEGUIMIENTO que aprovechen este momentum, continuando el tema desde ángulos DISTINTOS (nunca repitas el mismo contenido, expándelo: una parte 2, una objeción común, un caso de uso distinto, un detrás de cámaras, etc.).

Responde SOLO con un objeto JSON válido, sin markdown ni backticks, con esta forma exacta:
{"followups": [{"hook": "...", "format": "reel"|"carrusel"|"post", "reason": "por qué conecta con el post original, en español"}]}`;
}

type FollowupLLMResult = { followups: unknown[]; _meta?: { engine?: string } };

function isValidFollowup(v: unknown): v is SeriesFollowup {
  if (!v || typeof v !== "object") return false;
  const candidate = v as Record<string, unknown>;
  return (
    typeof candidate.hook === "string" && candidate.hook.trim().length > 0 &&
    typeof candidate.format === "string" && VALID_FORMATS.includes(candidate.format as FollowupFormat) &&
    typeof candidate.reason === "string" && candidate.reason.trim().length > 0
  );
}

async function generateFollowups(input: { hook: string; contentType: string; hashtags: string[]; score: number; avgScore: number }, tenantId: string, saasId: string): Promise<SeriesFollowup[]> {
  const { data } = await defaultLocalModel.generateStructured<FollowupLLMResult>(
    { prompt: buildFollowupPrompt(input), tenantId, saasId },
    () => ({ followups: [] }) as FollowupLLMResult,
  );

  if (data._meta?.engine !== "workers-ai" || !Array.isArray(data.followups)) return [];
  return data.followups.filter(isValidFollowup).slice(0, 4);
}

function feedSourceFor(postId: string): string {
  return `${SOURCE_PREFIX}:${postId}`;
}

// Detecta posts con momentum (score de engagement > 1.5x la media del período de 14
// días) y sugiere series de posts de seguimiento vía Mistral, filtrando ángulos que el
// cliente ya cubrió en sus últimos 30 días de posts publicados. Genera tarjetas
// "opportunity" en el Intelligence Feed (seedFeedItems/dismissFeedItemsBySource, source
// keyed por post original — se actualiza o se retira sola cuando el post sale de la
// ventana de 14 días o pierde momentum). Persiste en socialcors_content_series (tabla
// propia por tenant, migración 0232) para que el chat lea el snapshot ya calculado en
// vez de re-ejecutar este agente (posts + métricas + hasta 5 llamadas a Mistral) en cada
// mensaje.
export class ContentSeriesAgent {
  async run(input: { tenantId: string; saasId: string; accountType?: "influencer" | "empresa" }): Promise<ContentSeriesResult | null> {
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const allPosts = await listSaasSocialPosts(ctx);

    const published = allPosts.filter((post) => post.status === "POSTED" || post.status === "PUBLISHED");

    const recentWindowMs = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    const coverageWindowMs = Date.now() - COVERAGE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

    const recentPosts = published.filter((post) => new Date(post.postedAt ?? post.scheduledAt ?? post.createdAt).getTime() >= recentWindowMs);

    const withMetrics = await Promise.all(
      recentPosts.map(async (post): Promise<PostWithScore | null> => {
        const metrics = await listSaasSocialMetricsForPost(ctx, post.id).catch(() => []);
        const latest = metrics[0] ?? null;
        if (!latest) return null;
        const saved = typeof latest.metadata?.saved === "number" ? latest.metadata.saved : 0;
        const score = computeEngagementScore({ likes: latest.likes, comments: latest.comments, shares: latest.shares, saved });
        return { post, score };
      }),
    );
    const withRealMetrics = withMetrics.filter((x): x is PostWithScore => x !== null);

    if (withRealMetrics.length < MIN_POSTS_WITH_METRICS) return null;

    const avgScore = withRealMetrics.reduce((sum, p) => sum + p.score, 0) / withRealMetrics.length;
    const momentumPosts = withRealMetrics
      .filter((p) => p.score > avgScore * MOMENTUM_MULTIPLIER)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_MOMENTUM_POSTS);

    const publishedCorpus = normalizeText(
      published
        .filter((post) => new Date(post.postedAt ?? post.scheduledAt ?? post.createdAt).getTime() >= coverageWindowMs)
        .map((post) => `${post.title ?? ""} ${post.body ?? ""}`)
        .join(" "),
    );

    const seriesOpportunities: SeriesOpportunity[] = [];
    for (const momentum of momentumPosts) {
      const hook = extractHookWords(momentum.post.body);
      const hashtags = extractHashtags(momentum.post);

      const followups = await generateFollowups(
        { hook, contentType: momentum.post.contentType, hashtags, score: momentum.score, avgScore },
        input.tenantId,
        input.saasId,
      );
      const surviving = followups.filter((f) => !isAlreadyCovered(f.hook, publishedCorpus));

      if (surviving.length) {
        seriesOpportunities.push({
          originalPost: { id: momentum.post.id, hook, score: Math.round(momentum.score) },
          suggestedFollowups: surviving,
        });
      }
    }

    const result: ContentSeriesResult = { seriesOpportunities, totalOpportunities: seriesOpportunities.length };

    const dracoEnv = env();
    if (dracoEnv) {
      await syncContentSeriesFeed(input.tenantId, input.saasId, seriesOpportunities, dracoEnv);
      await upsertContentSeries(input.tenantId, input.saasId, JSON.stringify(result), withRealMetrics.length, dracoEnv);
    }

    return result;
  }
}

// --- Intelligence Feed (opportunity, source por post original) --------------------

async function syncContentSeriesFeed(
  tenantId: string,
  saasId: string,
  seriesOpportunities: SeriesOpportunity[],
  dracoEnv: DracoEnv,
): Promise<void> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return;

  const previous = await getLatestContentSeries(tenantId, saasId, dracoEnv);
  const currentPostIds = new Set(seriesOpportunities.map((s) => s.originalPost.id));

  for (const prevSeries of previous?.seriesOpportunities ?? []) {
    if (!currentPostIds.has(prevSeries.originalPost.id)) {
      await dismissFeedItemsBySource(tenantId, feedSourceFor(prevSeries.originalPost.id), saasId);
    }
  }

  for (const series of seriesOpportunities) {
    const followupLines = series.suggestedFollowups.map((f) => `"${f.hook}" (${f.format}) — ${f.reason}`).join(" · ");
    await seedFeedItems(
      tenantId,
      [
        {
          type: "opportunity" as const,
          priority: "medium" as const,
          title: `Serie de contenido a partir de "${series.originalPost.hook}"`,
          description: `Este post rindió muy por encima de tu media (score ${series.originalPost.score}). Ideas de seguimiento: ${followupLines}`,
          source: feedSourceFor(series.originalPost.id),
        },
      ],
      saasId,
    );
  }
}

// --- Persistencia (tabla propia por tenant, ver migración 0232) -------------------

async function upsertContentSeries(
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
      .prepare(`SELECT id FROM socialcors_content_series WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE socialcors_content_series SET snapshot_json = ?, post_count = ?, updated_at = ? WHERE id = ?`)
        .bind(snapshot, postCount, now, existing.id)
        .run();
      return;
    }

    await db
      .prepare(
        `INSERT INTO socialcors_content_series (id, tenant_id, saas_id, snapshot_json, post_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), tenantId, saasId, snapshot, postCount, now, now)
      .run();
  } catch (err) {
    console.error("[ContentSeriesAgent] upsertContentSeries failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
  }
}

// Lectura barata para el chat/feed sync — nunca vuelve a leer posts ni a llamar a
// Mistral, solo el snapshot que ya calculó el cron diario.
export async function getLatestContentSeries(
  tenantId: string,
  saasId: string,
  dracoEnv: DracoEnv,
): Promise<ContentSeriesResult | null> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return null;

  try {
    const row = await db
      .prepare(`SELECT snapshot_json FROM socialcors_content_series WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ snapshot_json: string }>();

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as ContentSeriesResult;
  } catch (err) {
    console.error("[ContentSeriesAgent] getLatestContentSeries failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return null;
  }
}
