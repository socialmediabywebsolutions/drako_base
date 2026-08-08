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

async function pickOldestNiche(db: D1Database): Promise<NicheRow | null> {
  const { results } = await db
    .prepare(
      `SELECT id, niche, analysis_json FROM socialcors_niche_intelligence
       ORDER BY trend_last_fetched ASC LIMIT 1`,
    )
    .all<NicheRow>();
  return results?.[0] ?? null;
}

// Un nicho por invocación, el menos recientemente refrescado primero — evita el mismo
// riesgo de timeout que ya arrastraba el cron semanal de niche-intelligence (55 nichos
// secuenciales en una sola petición HTTP), sin sacrificar frescura: a */20 min, una
// vuelta completa a los 55 nichos tarda ~18.3h, así que cada nicho se refresca más de
// una vez al día en vez de una vez a la semana.
export async function runTrendKeywordCron(env: Env): Promise<TrendKeywordResult> {
  const db = env?.SOCIAL_DB;
  if (!db) return { ok: true, niche: null, skipped: "SOCIAL_DB not configured" };

  const target = await pickOldestNiche(db);
  if (!target) {
    return { ok: true, niche: null, skipped: "no hay filas en socialcors_niche_intelligence todavía (niche-intelligence semanal no ha corrido)" };
  }

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
