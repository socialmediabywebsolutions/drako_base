import { defaultLocalModel } from "../models/localModel";
import { resolveSocialContext, listSaasSocialPosts } from "@/lib/socialflow/repository";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import { getKnowledgeContext } from "@/lib/socialflow/knowledge/repository";
import { seedFeedItems, dismissFeedItemsBySource } from "@/lib/socialflow/intelligence/repository";
import type { SaasSocialPost } from "@/lib/social-core/types";
import { env, type DracoEnv } from "@/lib/cf";

const MAX_POSTS_ANALYZED = 20;
const MIN_POSTS = 5;
const CHUNK_SIZE = 5;
const ALERT_THRESHOLD = 70;
const LOW_SCORE_THRESHOLD = 50;
const SOURCE = "brand_consistency";

type ScoredPost = { id: string; score: number; issue: string };

export type BrandConsistencyResult = {
  avgConsistencyScore: number;
  lowScorePosts: ScoredPost[];
  alert: boolean;
  recommendation: string;
};

function buildScorePrompt(posts: SaasSocialPost[], brandBlock: string): string {
  const numbered = posts.map((p, i) => `${i + 1}. (id: ${p.id}) "${p.body.replace(/"/g, "'").slice(0, 500)}"`).join("\n\n");
  return `Eres un auditor de identidad de marca. Este es el perfil de marca declarado del cliente:

${brandBlock}

Evalúa si cada uno de estos ${posts.length} posts generados por IA es coherente con ese perfil (tono, lenguaje, tema):

${numbered}

Para cada post, responde con un score de 0 a 100 (100 = totalmente coherente con la marca) y, si el score es menor a 70, una razón corta de por qué se aleja (si es ≥70, "issue" puede ser una cadena vacía).

Responde SOLO con un objeto JSON válido, sin markdown ni backticks, con esta forma exacta (un elemento por post, EN EL MISMO ORDEN, exactamente ${posts.length} elementos):
{"scores": [{"id": "...", "score": 0, "issue": "..."}]}`;
}

type ScoreLLMResult = { scores: unknown[]; _meta?: { engine?: string } };

function isValidScoreEntry(v: unknown): v is { id: string; score: number; issue: string } {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return typeof c.id === "string" && typeof c.score === "number" && Number.isFinite(c.score);
}

// Puntúa un chunk de posts contra el perfil de marca en UNA llamada — igual criterio de
// "batch para reducir llamadas" que SentimentTrendAgent (chunks de 20) y
// HashtagIntelligenceAgent, aquí en chunks de 5 (coincide con la ventana de "últimos 5
// posts" que usa el criterio de alerta). Si el engine falla o el array no valida
// (longitud distinta), esos posts se excluyen del resultado — nunca se asume un score
// que no se calculó de verdad.
async function scoreChunk(posts: SaasSocialPost[], brandBlock: string, tenantId: string, saasId: string): Promise<ScoredPost[]> {
  const { data } = await defaultLocalModel.generateStructured<ScoreLLMResult>(
    { prompt: buildScorePrompt(posts, brandBlock), tenantId, saasId },
    () => ({ scores: [] }) as ScoreLLMResult,
  );

  if (data._meta?.engine !== "workers-ai" || !Array.isArray(data.scores) || data.scores.length !== posts.length) {
    return [];
  }

  const postIds = new Set(posts.map((p) => p.id));
  return data.scores
    .filter(isValidScoreEntry)
    .filter((s) => postIds.has(s.id))
    .map((s) => ({ id: s.id, score: Math.max(0, Math.min(100, Math.round(s.score))), issue: typeof s.issue === "string" ? s.issue.trim() : "" }));
}

function buildRecommendationPrompt(lowScorePosts: ScoredPost[], brandBlock: string): string {
  const issues = lowScorePosts.map((p) => `- ${p.issue || "sin razón específica"}`).join("\n");
  return `Eres un auditor de identidad de marca. El contenido reciente generado por IA para este cliente se está alejando de su perfil de marca:

${brandBlock}

Razones detectadas:
${issues}

Da UNA recomendación concreta y accionable (máximo 2 frases, en español) para corregir el rumbo y volver a alinear el contenido con la marca.

Responde SOLO con un objeto JSON válido, sin markdown ni backticks: {"recommendation": "..."}`;
}

type RecommendationResult = { recommendation: string; _meta?: { engine?: string } };

async function generateRecommendation(lowScorePosts: ScoredPost[], brandBlock: string, tenantId: string, saasId: string): Promise<string> {
  const { data } = await defaultLocalModel.generateStructured<RecommendationResult>(
    { prompt: buildRecommendationPrompt(lowScorePosts, brandBlock), tenantId, saasId },
    () => ({ recommendation: "" }) as RecommendationResult,
  );

  if (data._meta?.engine === "workers-ai" && typeof data.recommendation === "string" && data.recommendation.trim()) {
    return data.recommendation.trim();
  }
  return "Revisa tus últimos posts generados por IA y ajusta el tono/voz para que vuelvan a sonar como tu marca.";
}

function feedSourceFor(): string {
  return SOURCE;
}

// Verifica que el contenido generado por IA (saas_social_posts.creation_mode = 'AUTO')
// sigue siendo coherente con el perfil de marca declarado del cliente (tono,
// personalidad, nicho, misión/propuesta de valor + KB) — detecta cuando el Cerebro está
// generando contenido "fuera de personaje". Genera una alerta HIGH en el Intelligence
// Feed cuando la media de los 5 posts más recientes cae por debajo de 70. Persiste en
// socialcors_brand_consistency (tabla propia por tenant, migración 0235).
export class BrandConsistencyAgent {
  async run(input: { tenantId: string; saasId: string; accountType?: "influencer" | "empresa" }): Promise<BrandConsistencyResult | null> {
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const allPosts = await listSaasSocialPosts(ctx);

    // creation_mode = 'AUTO' es el campo real que distingue lo generado por el Cerebro
    // de lo subido a mano ('MANUAL') — provider es la red social (INSTAGRAM/LINKEDIN),
    // no el origen del contenido.
    const aiPosts = allPosts
      .filter((post) => (post.creationMode ?? "AUTO") === "AUTO")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_POSTS_ANALYZED);

    if (aiPosts.length < MIN_POSTS) return null;

    const profile = await getChannelProfile(input.tenantId, input.saasId);
    const kbContext = await getKnowledgeContext(input.tenantId, input.saasId).catch(() => "");
    const brandBlock = [
      `Nicho: ${profile.niche || "no especificado"}`,
      `Tono de voz: ${profile.toneOfVoice || "no especificado"}`,
      `Personalidad: ${profile.personality || "no especificada"}`,
      profile.mission ? `Misión: ${profile.mission}` : "",
      profile.valueProposition ? `Propuesta de valor: ${profile.valueProposition}` : "",
      kbContext ? `Conocimiento adicional de marca:\n${kbContext.slice(0, 1500)}` : "",
    ].filter(Boolean).join("\n");

    const chunks: SaasSocialPost[][] = [];
    for (let i = 0; i < aiPosts.length; i += CHUNK_SIZE) chunks.push(aiPosts.slice(i, i + CHUNK_SIZE));

    const chunkResults = await Promise.all(chunks.map((chunk) => scoreChunk(chunk, brandBlock, input.tenantId, input.saasId)));
    const scoredById = new Map(chunkResults.flat().map((s) => [s.id, s]));

    // avgConsistencyScore = media del chunk 0 (los MIN_POSTS/CHUNK_SIZE posts más
    // recientes) — es exactamente la ventana que define el criterio de alerta, no la
    // media de los 20 analizados.
    const recentChunkScores = chunks[0].map((p) => scoredById.get(p.id)).filter((s): s is ScoredPost => s !== undefined);
    if (!recentChunkScores.length) return null;

    const avgConsistencyScore = Math.round(
      recentChunkScores.reduce((sum, s) => sum + s.score, 0) / recentChunkScores.length,
    );

    const lowScorePosts = Array.from(scoredById.values()).filter((s) => s.score < LOW_SCORE_THRESHOLD);
    const alert = avgConsistencyScore < ALERT_THRESHOLD;

    const recommendation = alert
      ? await generateRecommendation(
          lowScorePosts.length ? lowScorePosts : recentChunkScores.filter((s) => s.score < ALERT_THRESHOLD),
          brandBlock,
          input.tenantId,
          input.saasId,
        )
      : "Tu contenido reciente generado por IA es coherente con tu marca — sigue así.";

    const result: BrandConsistencyResult = { avgConsistencyScore, lowScorePosts, alert, recommendation };

    if (alert) {
      await seedFeedItems(
        input.tenantId,
        [
          {
            type: "alert" as const,
            priority: "high" as const,
            title: "El contenido reciente se está alejando de tu voz de marca",
            description: `Tus últimos posts generados por IA tienen un score de coherencia de marca de ${avgConsistencyScore}/100. ${recommendation}`,
            source: feedSourceFor(),
          },
        ],
        input.saasId,
      );
    } else {
      await dismissFeedItemsBySource(input.tenantId, feedSourceFor(), input.saasId);
    }

    const dracoEnv = env();
    if (dracoEnv) {
      await upsertBrandConsistency(input.tenantId, input.saasId, JSON.stringify(result), aiPosts.length, dracoEnv);
    }

    return result;
  }
}

// --- Persistencia (tabla propia por tenant, ver migración 0235) -------------------

async function upsertBrandConsistency(
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
      .prepare(`SELECT id FROM socialcors_brand_consistency WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE socialcors_brand_consistency SET snapshot_json = ?, post_count = ?, updated_at = ? WHERE id = ?`)
        .bind(snapshot, postCount, now, existing.id)
        .run();
      return;
    }

    await db
      .prepare(
        `INSERT INTO socialcors_brand_consistency (id, tenant_id, saas_id, snapshot_json, post_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), tenantId, saasId, snapshot, postCount, now, now)
      .run();
  } catch (err) {
    console.error("[BrandConsistencyAgent] upsertBrandConsistency failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
  }
}

// Lectura barata — nunca vuelve a leer posts ni a llamar a Mistral, solo el snapshot
// que ya calculó el cron diario.
export async function getLatestBrandConsistency(
  tenantId: string,
  saasId: string,
  dracoEnv: DracoEnv,
): Promise<BrandConsistencyResult | null> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return null;

  try {
    const row = await db
      .prepare(`SELECT snapshot_json FROM socialcors_brand_consistency WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ snapshot_json: string }>();

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as BrandConsistencyResult;
  } catch (err) {
    console.error("[BrandConsistencyAgent] getLatestBrandConsistency failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return null;
  }
}
