import { safeParseObject, type Env } from "./NicheIntelligenceService";
import { fetchYoutubeHooks, fetchRedditTopics, fetchGlobalTrends, buildYoutubeQuery, NICHE_TO_SUBREDDIT } from "./trendSources";

export type TrendSignals = {
  youtubeHooks: string[];
  redditTopics: string[];
  globalTrends: string[];
  fetchedAt: string;
  // true cuando faltó YOUTUBE_API_KEY o falló la llamada — transparencia sobre qué
  // fracción de la señal es real vs ausente, en vez de fingir que youtubeHooks: []
  // siempre significa "sin resultados" cuando también puede significar "sin key".
  youtubeDegraded: boolean;
};

// Validador compartido para analysis_json.trendSignals — mismo criterio que
// extractEngagementPatterns en CrossTenantIntelligenceAgent.ts: nunca confiar
// ciegamente en la forma de un JSON guardado, ni siquiera el que escribimos nosotros
// mismos la semana pasada.
export function extractTrendSignals(analysis: Record<string, unknown> | null | undefined): TrendSignals | null {
  const raw = analysis?.trendSignals;
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<TrendSignals>;
  if (!Array.isArray(candidate.youtubeHooks)) return null;
  return candidate as TrendSignals;
}

export type TrendKeywordResult =
  | { ok: true; niche: string }
  | { ok: true; niche: null; skipped: string }
  | { ok: false; niche: string; error: string };

type NicheRow = { id: string; niche: string; analysis_json: string };

// 3 filas por corrida — con 132 filas (66 nichos × 2 accountTypes, ver migración 0224)
// y un cron cada 20 min, una vuelta completa tarda ~(132/3) × 20min ≈ 14.7h, en vez de
// las ~44h que tardaría procesando de una en una. Ajustable si hace falta recalibrar
// contra los límites de rate de YouTube/Reddit.
const BATCH_SIZE = 3;
const BETWEEN_ITEM_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pickOldestNiches(db: D1Database, limit: number): Promise<NicheRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, niche, analysis_json FROM socialcors_niche_intelligence
       ORDER BY trend_last_fetched ASC LIMIT ?`,
    )
    .bind(limit)
    .all<NicheRow>();
  return results ?? [];
}

async function processNiche(db: D1Database, target: NicheRow, env: Env): Promise<TrendKeywordResult> {
  try {
    const youtubeApiKey = env?.YOUTUBE_API_KEY;
    const query = buildYoutubeQuery(target.niche);
    const subreddit = NICHE_TO_SUBREDDIT[target.niche];

    const [youtubeResult, redditTopics, globalTrends] = await Promise.all([
      youtubeApiKey ? fetchYoutubeHooks(query, youtubeApiKey) : Promise.resolve({ hooks: [], ok: false }),
      fetchRedditTopics(subreddit),
      fetchGlobalTrends(),
    ]);

    const fetchedAt = new Date().toISOString();
    const trendSignals: TrendSignals = {
      youtubeHooks: youtubeResult.hooks,
      redditTopics: redditTopics ?? [],
      globalTrends,
      fetchedAt,
      youtubeDegraded: !youtubeApiKey || !youtubeResult.ok,
    };

    const currentAnalysis = safeParseObject(target.analysis_json) ?? {};
    const nextAnalysis = { ...currentAnalysis, trendSignals };

    await db
      .prepare(`UPDATE socialcors_niche_intelligence SET analysis_json = ?, trend_last_fetched = ?, updated_at = ? WHERE id = ?`)
      .bind(JSON.stringify(nextAnalysis), fetchedAt, fetchedAt, target.id)
      .run();

    return { ok: true, niche: target.niche };
  } catch (err) {
    return { ok: false, niche: target.niche, error: err instanceof Error ? err.message : String(err) };
  }
}

// Procesa un LOTE de BATCH_SIZE filas por invocación, las menos recientemente
// refrescadas primero — secuencial (no Promise.all) con una pequeña pausa entre cada
// una para no ráfagar las APIs externas (YouTube/Reddit/Google Trends) de golpe. Un
// nicho fallido nunca detiene el resto del lote (mismo criterio que
// NicheIntelligenceCronAgent.runNicheIntelligenceCron).
export async function runTrendKeywordCron(env: Env): Promise<TrendKeywordResult[]> {
  const db = env?.SOCIAL_DB;
  if (!db) return [{ ok: true, niche: null, skipped: "SOCIAL_DB not configured" }];

  const targets = await pickOldestNiches(db, BATCH_SIZE);
  if (!targets.length) {
    return [{ ok: true, niche: null, skipped: "no hay filas en socialcors_niche_intelligence todavía (niche-intelligence semanal no ha corrido)" }];
  }

  const results: TrendKeywordResult[] = [];
  for (let i = 0; i < targets.length; i += 1) {
    results.push(await processNiche(db, targets[i], env));
    if (i < targets.length - 1) await sleep(BETWEEN_ITEM_DELAY_MS);
  }
  return results;
}
