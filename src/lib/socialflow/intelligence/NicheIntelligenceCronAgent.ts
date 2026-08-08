import { defaultLocalModel } from "../ai/models/localModel";
import { safeParseObject, type Env, type NicheOptimalHour } from "./NicheIntelligenceService";
import { extractEngagementPatterns } from "./CrossTenantIntelligenceAgent";
import { extractTrendSignals } from "./TrendKeywordAgent";

export const NICHE_INTELLIGENCE_NICHES = [
  // Influencers
  "fitness",
  "lifestyle",
  "educacion",
  "moda",
  "viajes",
  "nutricion",
  "maternidad",
  "belleza",
  "gaming",
  "musica",
  "humor",
  "finanzas_personales",
  "mindfulness",
  "mascotas",
  "running",
  "yoga",
  "crossfit",
  "ciclismo",
  "fotografia_creativa",
  "arquitectura_interiores",
  "tecnologia",
  "emprendimiento",
  "arte_digital",
  "cocina_recetas",
  "sostenibilidad",
  // Empresas
  "restauracion",
  "peluqueria",
  "clinica_dental",
  "inmobiliaria",
  "marketing",
  "gimnasio",
  "farmacia",
  "abogados",
  "asesoria_contable",
  "automocion",
  "joyeria",
  "optica",
  "veterinaria",
  "hotel",
  "agencia_viajes",
  "estetica_spa",
  "academia_idiomas",
  "psicologia",
  "reformas_arquitectura",
  "tienda_ropa",
  "floristerias",
  "fotografia_profesional",
  "clinica_medica",
  "clinica_fisioterapia",
  "ecommerce_general",
  "bar_copas",
  "cafeteria",
  "pasteleria",
  "academia_infantil",
  "centro_deportivo",
] as const;

export type NicheIntelligenceNiche = (typeof NICHE_INTELLIGENCE_NICHES)[number];

export type NicheIntelligenceCronResult = { niche: string; ok: boolean; error?: string };

// Refreshed weekly — 7 days matches the cron cadence (Mondays 03:00 UTC), so a
// cache row is always either fresh or in the process of being replaced by that
// week's run, never silently stale for extended periods.
const VALID_FOR_MS = 7 * 24 * 60 * 60 * 1000;

type NicheAnalysisPayload = {
  analysis: string;
  hashtags: string[];
  formats: string[];
  hooks: string[];
  optimalHours: NicheOptimalHour[];
  fatigueSignals: string[];
};

// generateStructured() decorates its result with _meta.engine — "workers-ai" on a
// real, successfully-parsed model response, "local-deterministic-stub" on ANY
// failure (missing AI binding, empty response, malformed JSON — see
// WorkersAiLocalModel.generateStructured, which never throws and always falls
// back to the seed instead). Checking that flag here is what stands in for the
// "parse with try/catch, skip on failure" requirement: we must never UPSERT the
// stub's empty seed over last week's real data.
type NicheAnalysisResult = NicheAnalysisPayload & { _meta?: { engine?: string } };

function buildNicheAnalysisPrompt(niche: string): string {
  return `Eres un analista de tendencias de redes sociales especializado en el nicho "${niche}" para el mercado hispanohablante (España y Latinoamérica). Analiza el estado actual de este nicho en Instagram esta semana.

Responde SOLO con un objeto JSON válido, sin markdown, sin backticks, sin comentarios ni texto fuera del JSON, con esta forma exacta:

{
  "analysis": "resumen en 2-3 párrafos, en español, del momento actual del nicho ${niche}: qué tipo de contenido está funcionando, qué está cambiando, qué oportunidades hay esta semana",
  "hashtags": ["15 a 20 hashtags en tendencia esta semana para ${niche}, en español, cada uno empezando por #"],
  "formats": ["3 a 5 formatos de contenido que están funcionando mejor ahora mismo en este nicho, ej: 'Reels de 15s con texto grande', 'Carruseles educativos de 5 slides'"],
  "hooks": ["5 a 8 frases de apertura (primera línea de un post) que están funcionando en este nicho ahora mismo"],
  "optimalHours": [{"day": "lunes", "hour": 19, "score": 85}],
  "fatigueSignals": ["señales de qué tipo de contenido está sobreexplotado o saturado en este nicho ahora mismo y conviene evitar"]
}

Para "optimalHours" incluye entre 3 y 7 entradas, "day" en español (lunes..domingo), "hour" en UTC de 0 a 23, "score" de 0 a 100 según qué tan bueno es ese momento para publicar.
Responde en español. Solo el JSON, nada más.`;
}

async function upsertNicheIntelligence(niche: string, payload: NicheAnalysisPayload, db: D1Database): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const validUntil = new Date(now.getTime() + VALID_FOR_MS).toISOString();

  const existing = await db
    .prepare(`SELECT id, analysis_json FROM socialcors_niche_intelligence WHERE niche = ? LIMIT 1`)
    .bind(niche)
    .first<{ id: string; analysis_json: string }>();

  // Real hashtags (Sprint F) take priority over the LLM's opinion when available. What's
  // read here is last week's analysis_json — CrossTenantIntelligenceAgent runs AFTER this
  // cron step in the weekly chain, so "real this week" doesn't exist yet at this point;
  // it re-merges fresh engagementPatterns onto this same row a few minutes later, same as
  // it's done since Sprint D. One-week lag, not a bug — every niche-intelligence-derived
  // signal already has it.
  const realHashtags = existing
    ? extractEngagementPatterns(safeParseObject(existing.analysis_json))?.hashtagsQueFuncionanRealmente
    : undefined;
  const hashtags = realHashtags?.length ? realHashtags.map((h) => h.hashtag) : payload.hashtags;

  // Mismo criterio que los hashtags reales (Sprint F) — hooks reales de YouTube
  // (Sprint G, TrendKeywordAgent) tienen prioridad sobre la opinión del LLM cuando
  // existen. Igual desfase inherente que los hashtags: lo que se lee aquí es el
  // trendSignals más reciente que TrendKeywordAgent ya haya escrito para este nicho —
  // a */20 min con 55 nichos, como mucho ~18.3h de antigüedad, no una semana.
  const realHooks = existing
    ? extractTrendSignals(safeParseObject(existing.analysis_json))?.youtubeHooks
    : undefined;
  const hooks = realHooks?.length ? realHooks.slice(0, 8) : payload.hooks;

  const analysisJson = JSON.stringify({ summary: payload.analysis });
  const hashtagsJson = JSON.stringify(hashtags);
  const formatsJson = JSON.stringify(payload.formats);
  const hooksJson = JSON.stringify(hooks);
  const optimalHoursJson = JSON.stringify(payload.optimalHours);
  const fatigueSignalsJson = JSON.stringify(payload.fatigueSignals);

  if (existing) {
    await db
      .prepare(
        `UPDATE socialcors_niche_intelligence
         SET analysis_json = ?, hashtags_json = ?, formats_json = ?, hooks_json = ?,
             optimal_hours_json = ?, fatigue_signals_json = ?, updated_at = ?, valid_until = ?
         WHERE id = ?`,
      )
      .bind(analysisJson, hashtagsJson, formatsJson, hooksJson, optimalHoursJson, fatigueSignalsJson, nowIso, validUntil, existing.id)
      .run();
    return;
  }

  await db
    .prepare(
      `INSERT INTO socialcors_niche_intelligence
         (id, niche, analysis_json, hashtags_json, formats_json, hooks_json, optimal_hours_json, fatigue_signals_json, created_at, updated_at, valid_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), niche, analysisJson, hashtagsJson, formatsJson, hooksJson, optimalHoursJson, fatigueSignalsJson, nowIso, nowIso, validUntil)
    .run();
}

// Regenerates the niche intelligence cache row for a single niche. Never throws
// on a bad/missing model response — logs and returns, leaving whatever was
// cached from the previous run in place (better a week-stale row than an empty
// one). Callers that need failures surfaced (the cron loop, the admin endpoint)
// should still wrap calls in their own try/catch for infra-level errors (DB
// unavailable, etc.) — this function only swallows model-generation failures.
export async function generateNicheAnalysis(niche: string, env: Env): Promise<void> {
  const db = env?.SOCIAL_DB;
  if (!db) {
    console.error("[NicheIntelligenceCronAgent] SOCIAL_DB not configured, skipping", niche);
    return;
  }

  const seed: NicheAnalysisPayload = {
    analysis: "",
    hashtags: [],
    formats: [],
    hooks: [],
    optimalHours: [],
    fatigueSignals: [],
  };

  const { data } = await defaultLocalModel.generateStructured<NicheAnalysisResult>(
    { prompt: buildNicheAnalysisPrompt(niche) },
    () => seed as NicheAnalysisResult,
  );

  if (data._meta?.engine !== "workers-ai") {
    console.error("[NicheIntelligenceCronAgent] model generation failed or returned invalid JSON, skipping upsert", niche);
    return;
  }

  await upsertNicheIntelligence(niche, data, db);
  console.log("[NicheIntelligenceCronAgent] niche intelligence updated", niche);
}

// Iterates all niches sequentially (not Promise.all) to respect Workers AI rate
// limits — see generateNicheAnalysis for why a single niche never throws for
// model-generation reasons; the try/catch here is for infra-level failures
// (DB errors) so one bad niche never stops the rest of the run.
export async function runNicheIntelligenceCron(env: Env): Promise<NicheIntelligenceCronResult[]> {
  const results: NicheIntelligenceCronResult[] = [];

  for (const niche of NICHE_INTELLIGENCE_NICHES) {
    console.log("[NicheIntelligenceCronAgent] starting niche", niche);
    try {
      await generateNicheAnalysis(niche, env);
      results.push({ niche, ok: true });
    } catch (err) {
      console.error("[NicheIntelligenceCronAgent] niche failed", niche, err instanceof Error ? err.message : String(err));
      results.push({ niche, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    console.log("[NicheIntelligenceCronAgent] finished niche", niche);
  }

  return results;
}
