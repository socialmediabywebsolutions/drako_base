import { defaultLocalModel } from "../models/localModel";
import { env, type DracoEnv } from "@/lib/cf";
import { resolveSocialContext, listSaasSocialPosts } from "@/lib/socialflow/repository";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import { getSocialFlowAccountTypeByTenant } from "@/lib/socialflow/auth/account-type";
import { getNicheIntelligence } from "@/lib/socialflow/intelligence/NicheIntelligenceService";
import { extractEngagementPatterns } from "@/lib/socialflow/intelligence/CrossTenantIntelligenceAgent";
import { extractHashtags } from "./contentHeuristics";

const MAX_POSTS_ANALYZED = 50;
const MIN_POSTS_WITH_HASHTAGS = 5;
const OVERUSE_THRESHOLD = 0.6;
const MIX_GROUP_SIZE = 5;

export type HashtagMix = {
  niche: string[];
  trending: string[];
  reach: string[];
};

export type HashtagIntelligenceResult = {
  overusedHashtags: string[];
  recommendedMix: HashtagMix;
  insight: string;
};

type HashtagPayload = {
  niche: string[];
  trending: string[];
  reach: string[];
  insight: string;
};

// generateStructured() decorates su resultado con _meta.engine — "workers-ai" en una
// respuesta real, "local-deterministic-stub" ante cualquier fallo. Mismo criterio que el
// resto del Cerebro: nunca confiar en el seed vacío como si fuera un análisis real.
type HashtagResult = HashtagPayload & { _meta?: { engine?: string } };

function buildFallbackPayload(
  niche: string,
  realTrendingHashtags: string[],
  nicheHashtagsFromLLM: string[],
  overused: string[],
): HashtagPayload {
  const overusedLower = new Set(overused.map((h) => h.toLowerCase()));
  const pool = Array.from(new Set([...realTrendingHashtags, ...nicheHashtagsFromLLM])).filter(
    (h) => !overusedLower.has(h.toLowerCase()),
  );
  return {
    niche: pool.slice(0, 5),
    trending: pool.slice(5, 10),
    reach: pool.slice(10, 15),
    insight: overused.length
      ? `Tienes hashtags sobreusados (${overused.slice(0, 3).join(", ")}) — rótalos con más frecuencia en tus próximos posts.`
      : `Todavía no hay suficientes datos reales de tendencia para "${niche}" — sigue variando tus hashtags mientras el Cerebro recopila más señal.`,
  };
}

function buildPrompt(input: {
  niche: string;
  topUsed: string[];
  overused: string[];
  realTrendingHashtags: string[];
  nicheHashtagsFromLLM: string[];
}): string {
  return `Eres un experto en estrategia de hashtags de Instagram para el nicho "${input.niche}".

Hashtags que este cliente ya ha usado en sus últimos posts (formato: hashtag (veces usado/total posts analizados)):
${input.topUsed.join(", ") || "(sin datos)"}

${input.overused.length ? `⚠️ Hashtags SOBREUSADOS (aparecen en más del 60% de sus posts — el algoritmo de Instagram penaliza la repetición constante, hay que rotarlos): ${input.overused.join(" ")}\n` : ""}${input.realTrendingHashtags.length ? `Hashtags con tracción real medida en este nicho ahora mismo (datos reales de otras cuentas — prioriza estos para el grupo "trending"): ${input.realTrendingHashtags.join(" ")}\n` : ""}${input.nicheHashtagsFromLLM.length ? `Hashtags en tendencia general del nicho: ${input.nicheHashtagsFromLLM.join(" ")}\n` : ""}
Genera un mix recomendado de exactamente 15 hashtags dividido en 3 grupos de 5:
- "niche": hashtags de nicho específico, medio competitivos, con comunidad comprometida (nada genérico).
- "trending": hashtags que están sonando ahora mismo en este nicho (usa los datos reales de arriba si los hay — nunca inventes una cifra de popularidad).
- "reach": hashtags más amplios del nicho, para maximizar descubrimiento.

Ningún hashtag del mix debe coincidir con la lista de sobreusados de arriba.

Responde SOLO con un objeto JSON válido, sin markdown ni backticks, con esta forma exacta:
{
  "niche": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
  "trending": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
  "reach": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
  "insight": "2-3 frases en español explicando el razonamiento del mix y qué rotar"
}`;
}

// Analiza los hashtags reales usados por el tenant (frecuencia, sobreuso) y los cruza
// con tendencias reales del nicho para recomendar un mix — persiste en
// socialcors_hashtag_intelligence (tabla propia por tenant, migración 0227) para que el
// chat y ContentGeneratorAgent lean el snapshot ya calculado en vez de re-ejecutar este
// agente (posts + llamada a Mistral) en cada request.
export class HashtagIntelligenceAgent {
  async run(input: { tenantId: string; saasId: string; accountType?: "influencer" | "empresa" }): Promise<HashtagIntelligenceResult | null> {
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const allPosts = await listSaasSocialPosts(ctx);

    const published = allPosts
      .filter((post) => post.status === "POSTED" || post.status === "PUBLISHED")
      .sort((a, b) =>
        new Date(b.postedAt ?? b.scheduledAt ?? b.createdAt).getTime()
        - new Date(a.postedAt ?? a.scheduledAt ?? a.createdAt).getTime(),
      )
      .slice(0, MAX_POSTS_ANALYZED);

    const postsWithHashtags = published.map((post) => extractHashtags(post)).filter((hashtags) => hashtags.length > 0);
    if (postsWithHashtags.length < MIN_POSTS_WITH_HASHTAGS) return null;

    const frequency = new Map<string, number>();
    for (const hashtags of postsWithHashtags) {
      for (const tag of hashtags) frequency.set(tag, (frequency.get(tag) ?? 0) + 1);
    }
    const totalPosts = postsWithHashtags.length;

    const overusedHashtags = Array.from(frequency.entries())
      .filter(([, count]) => count / totalPosts > OVERUSE_THRESHOLD)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);

    const topUsed = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag, count]) => `${tag} (${count}/${totalPosts})`);

    const profile = await getChannelProfile(input.tenantId, input.saasId);
    const accountType =
      input.accountType ?? (await getSocialFlowAccountTypeByTenant(input.tenantId).catch(() => null)) ?? "influencer";

    const dracoEnv = env();
    const nicheIntel =
      dracoEnv && profile.niche
        ? await getNicheIntelligence(profile.niche, dracoEnv, input.tenantId, input.saasId, accountType).catch(() => null)
        : null;
    const realTrendingHashtags = (extractEngagementPatterns(nicheIntel?.analysis)?.hashtagsQueFuncionanRealmente ?? [])
      .slice(0, 10)
      .map((h) => h.hashtag);
    const nicheHashtagsFromLLM = nicheIntel?.hashtags ?? [];

    const fallback = buildFallbackPayload(profile.niche, realTrendingHashtags, nicheHashtagsFromLLM, overusedHashtags);

    const { data } = await defaultLocalModel.generateStructured<HashtagResult>(
      {
        prompt: buildPrompt({ niche: profile.niche, topUsed, overused: overusedHashtags, realTrendingHashtags, nicheHashtagsFromLLM }),
        tenantId: input.tenantId,
        saasId: input.saasId,
      },
      () => fallback as HashtagResult,
    );

    const usable =
      data._meta?.engine === "workers-ai" &&
      Array.isArray(data.niche) && Array.isArray(data.trending) && Array.isArray(data.reach);
    const payload = usable ? data : fallback;

    const result: HashtagIntelligenceResult = {
      overusedHashtags,
      recommendedMix: {
        niche: payload.niche.slice(0, MIX_GROUP_SIZE),
        trending: payload.trending.slice(0, MIX_GROUP_SIZE),
        reach: payload.reach.slice(0, MIX_GROUP_SIZE),
      },
      insight: typeof payload.insight === "string" && payload.insight.trim() ? payload.insight.trim() : fallback.insight,
    };

    if (dracoEnv) {
      await upsertHashtagIntelligence(input.tenantId, input.saasId, JSON.stringify(result), postsWithHashtags.length, dracoEnv);
    }

    return result;
  }
}

// --- Persistencia (tabla propia por tenant, ver migración 0227) -------------------

async function upsertHashtagIntelligence(
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
      .prepare(`SELECT id FROM socialcors_hashtag_intelligence WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE socialcors_hashtag_intelligence SET snapshot_json = ?, post_count = ?, updated_at = ? WHERE id = ?`)
        .bind(snapshot, postCount, now, existing.id)
        .run();
      return;
    }

    await db
      .prepare(
        `INSERT INTO socialcors_hashtag_intelligence (id, tenant_id, saas_id, snapshot_json, post_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), tenantId, saasId, snapshot, postCount, now, now)
      .run();
  } catch (err) {
    console.error("[HashtagIntelligenceAgent] upsertHashtagIntelligence failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
  }
}

// Lectura barata para el chat/ContentGeneratorAgent — nunca vuelve a leer posts ni a
// llamar a Mistral, solo el snapshot que ya calculó el cron diario.
export async function getLatestHashtagIntelligence(
  tenantId: string,
  saasId: string,
  dracoEnv: DracoEnv,
): Promise<HashtagIntelligenceResult | null> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return null;

  try {
    const row = await db
      .prepare(`SELECT snapshot_json FROM socialcors_hashtag_intelligence WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ snapshot_json: string }>();

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as HashtagIntelligenceResult;
  } catch (err) {
    console.error("[HashtagIntelligenceAgent] getLatestHashtagIntelligence failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return null;
  }
}
