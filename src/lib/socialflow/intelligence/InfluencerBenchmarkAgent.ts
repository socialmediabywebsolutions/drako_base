import { defaultLocalModel } from "../ai/models/localModel";
import { fetchTopYoutubeChannels, type YoutubeChannelBenchmark } from "./trendSources";
import { NICHE_INTELLIGENCE_NICHES } from "./NicheIntelligenceCronAgent";
import { resolveNicheSlug, type Env } from "./NicheIntelligenceService";

// Refrescado semanalmente junto a socialcors_niche_intelligence (mismo TTL) — solo
// relevante para accountType="influencer"; el filtro se aplica al LEER desde el chat,
// no aquí (esta tabla no tiene columna account_type, es benchmark por nicho, no por
// tenant — ver migración 0226).
const VALID_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export type InfluencerBenchmarkTopChannel = {
  name: string;
  subscribers: number;
  avgViews: number;
  topHooks: string[];
};

export type InfluencerBenchmarkPatterns = {
  commonHooks: string[];
  commonFormats: string[];
};

export type InfluencerBenchmarkResult = {
  topChannels: InfluencerBenchmarkTopChannel[];
  insight: string;
  patterns: InfluencerBenchmarkPatterns;
};

export type InfluencerBenchmarkCronResult = { niche: string; ok: boolean; error?: string };

type BenchmarkPayload = {
  insight: string;
  commonHooks: string[];
  commonFormats: string[];
};

// generateStructured() decorates con _meta.engine ("workers-ai" en respuesta real,
// "local-deterministic-stub" en cualquier fallo) — mismo criterio que
// NicheIntelligenceCronAgent para no confiar en el seed vacío como si fuera un
// análisis real.
type BenchmarkResult = BenchmarkPayload & { _meta?: { engine?: string } };

function buildBenchmarkPrompt(niche: string, channels: YoutubeChannelBenchmark[]): string {
  const channelsBlock = channels
    .map(
      (c, i) =>
        `${i + 1}. ${c.name} — ${c.subscribers.toLocaleString("es-ES")} suscriptores, ${Math.round(c.avgViews).toLocaleString("es-ES")} vistas promedio por vídeo.
   Títulos de sus vídeos más vistos esta semana en este nicho: ${c.topHooks.map((h) => `"${h}"`).join(", ") || "(ninguno)"}`,
    )
    .join("\n");

  return `Eres un analista de contenido viral de YouTube especializado en el nicho "${niche}" para el mercado hispanohablante. Estos son los 3 canales con más vistas reales esta semana en este nicho (nunca inventes datos que no estén aquí):

${channelsBlock}

Analiza qué tipo de hooks usan, qué formato de contenido predomina (nota: infiere el formato SOLO a partir de los títulos, no tienes duración ni tipo de vídeo real — sé honesto sobre esa limitación si no es evidente) y qué los hace virales en este nicho.

Responde SOLO con un objeto JSON válido, sin markdown, con esta forma exacta:
{
  "insight": "2-3 frases accionables en español sobre por qué funcionan y qué patrón común hay entre los 3",
  "commonHooks": ["2-4 tipos de hook que se repiten entre los títulos de arriba"],
  "commonFormats": ["1-3 formatos/estilos de contenido que parecen predominar, según los títulos"]
}`;
}

async function benchmarkNiche(niche: string, apiKey: string): Promise<InfluencerBenchmarkResult | null> {
  const { channels, ok } = await fetchTopYoutubeChannels(niche, apiKey);
  if (!ok || !channels.length) return null;

  const topChannels: InfluencerBenchmarkTopChannel[] = channels.map((c) => ({
    name: c.name,
    subscribers: c.subscribers,
    avgViews: c.avgViews,
    topHooks: c.topHooks,
  }));

  const { data } = await defaultLocalModel.generateStructured<BenchmarkResult>(
    { prompt: buildBenchmarkPrompt(niche, channels) },
    () => ({ insight: "", commonHooks: [], commonFormats: [] }),
  );

  const patterns: InfluencerBenchmarkPatterns = {
    commonHooks: Array.isArray(data.commonHooks) ? data.commonHooks.slice(0, 4) : [],
    commonFormats: Array.isArray(data.commonFormats) ? data.commonFormats.slice(0, 3) : [],
  };

  const insight =
    data._meta?.engine === "workers-ai" && typeof data.insight === "string" && data.insight.trim()
      ? data.insight.trim()
      : `Los canales con más vistas esta semana en "${niche}" son ${topChannels.map((c) => c.name).join(", ")} — sin análisis detallado disponible en este momento.`;

  return { topChannels, insight, patterns };
}

async function upsertInfluencerBenchmark(niche: string, result: InfluencerBenchmarkResult, db: D1Database): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const validUntil = new Date(now.getTime() + VALID_FOR_MS).toISOString();
  const snapshotJson = JSON.stringify(result);

  const existing = await db
    .prepare(`SELECT id FROM socialcors_influencer_benchmarks WHERE niche = ? LIMIT 1`)
    .bind(niche)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(`UPDATE socialcors_influencer_benchmarks SET snapshot_json = ?, updated_at = ?, valid_until = ? WHERE id = ?`)
      .bind(snapshotJson, nowIso, validUntil, existing.id)
      .run();
    return;
  }

  await db
    .prepare(
      `INSERT INTO socialcors_influencer_benchmarks (id, niche, snapshot_json, created_at, updated_at, valid_until)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), niche, snapshotJson, nowIso, nowIso, validUntil)
    .run();
}

// Itera los 66 nichos secuencialmente (no Promise.all) — mismo criterio que
// runNicheIntelligenceCron: respeta rate limits externos (aquí, cuota de YouTube Data
// API — 100 unidades/nicho por search.list + 1 por channels.list) y evita el riesgo de
// timeout de una sola petición HTTP larga. Un nicho fallido nunca detiene el resto.
export async function runInfluencerBenchmarkCron(env: Env): Promise<InfluencerBenchmarkCronResult[]> {
  const db = env?.SOCIAL_DB;
  const apiKey = env?.YOUTUBE_API_KEY;
  if (!db) return [{ niche: "", ok: false, error: "SOCIAL_DB not configured" }];
  if (!apiKey) return [{ niche: "", ok: false, error: "YOUTUBE_API_KEY not configured" }];

  const results: InfluencerBenchmarkCronResult[] = [];

  for (const niche of NICHE_INTELLIGENCE_NICHES) {
    try {
      const result = await benchmarkNiche(niche, apiKey);
      if (!result) {
        results.push({ niche, ok: true });
        continue;
      }
      await upsertInfluencerBenchmark(niche, result, db);
      results.push({ niche, ok: true });
    } catch (err) {
      console.error("[InfluencerBenchmarkAgent] niche failed", niche, err instanceof Error ? err.message : String(err));
      results.push({ niche, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return results;
}

type InfluencerBenchmarkRow = { snapshot_json: string; valid_until: string };

// Lectura barata para el chat — nunca vuelve a llamar a la YouTube Data API ni a
// Mistral, solo lee el snapshot que ya calculó el cron semanal. rawNiche es el texto
// libre del cliente (ej. profile.niche) — se resuelve al slug de la tabla igual que
// getNicheIntelligence, con el mismo criterio de caché en ChannelProfile
// (normalizedNicheSlug) cuando se pasan tenantId/saasId.
export async function getInfluencerBenchmark(
  rawNiche: string,
  env: Env,
  tenantId?: string,
  saasId?: string,
): Promise<InfluencerBenchmarkResult | null> {
  const db = env?.SOCIAL_DB;
  if (!db || !rawNiche) return null;

  try {
    const niche = await resolveNicheSlug(rawNiche, db, tenantId, saasId);
    if (!niche) return null;

    const now = new Date().toISOString();
    const row = await db
      .prepare(`SELECT snapshot_json, valid_until FROM socialcors_influencer_benchmarks WHERE niche = ? AND valid_until > ? LIMIT 1`)
      .bind(niche, now)
      .first<InfluencerBenchmarkRow>();

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as InfluencerBenchmarkResult;
  } catch (err) {
    console.error("[InfluencerBenchmarkAgent] getInfluencerBenchmark failed", rawNiche, err instanceof Error ? err.message : String(err));
    return null;
  }
}

export type InfluencerBenchmarkWithFreshness = {
  benchmark: InfluencerBenchmarkResult;
  stale: boolean;
  updatedAt: string;
};

// Variante para el generador de contenido: devuelve el snapshot aunque haya caducado
// (valid_until pasado), marcado con stale=true para que el prompt lo presente como
// referencia aproximada — un benchmark de hace unas semanas sigue siendo mejor
// contexto que ninguno. getInfluencerBenchmark (chat) mantiene su filtro estricto.
export async function getInfluencerBenchmarkAnyAge(
  rawNiche: string,
  env: Env,
  tenantId?: string,
  saasId?: string,
): Promise<InfluencerBenchmarkWithFreshness | null> {
  const db = env?.SOCIAL_DB;
  if (!db || !rawNiche) return null;

  try {
    const niche = await resolveNicheSlug(rawNiche, db, tenantId, saasId);
    if (!niche) return null;

    const row = await db
      .prepare(`SELECT snapshot_json, valid_until, updated_at FROM socialcors_influencer_benchmarks WHERE niche = ? LIMIT 1`)
      .bind(niche)
      .first<InfluencerBenchmarkRow & { updated_at: string }>();

    if (!row) return null;
    return {
      benchmark: JSON.parse(row.snapshot_json) as InfluencerBenchmarkResult,
      stale: row.valid_until <= new Date().toISOString(),
      updatedAt: row.updated_at,
    };
  } catch (err) {
    console.error("[InfluencerBenchmarkAgent] getInfluencerBenchmarkAnyAge failed", rawNiche, err instanceof Error ? err.message : String(err));
    return null;
  }
}
