import { defaultLocalModel } from "../models/localModel";
import { NICHE_INTELLIGENCE_NICHES } from "@/lib/socialflow/intelligence/NicheIntelligenceCronAgent";
import { resolveNicheSlug, type Env } from "@/lib/socialflow/intelligence/NicheIntelligenceService";

export type SeasonalityCronResult = { niche: string; ok: boolean; skipped: boolean; error?: string };

// Refrescado cada noche (ver /api/cron/social/seasonality + la rama "0 3 * * *" del
// scheduled() handler), pero acotado al mes calendario, no a una ventana rodante — 30
// días encaja con "el mes no cambia tan rápido". La mayoría de noches este cron encuentra
// el row del mes en curso de cada nicho ya válido y no hace nada. Deliberadamente más
// largo que el TTL de 7 días de NicheIntelligenceCronAgent (ver VALID_FOR_MS ahí): esta
// caché no necesita frescura semanal, solo "que el contenido del mes correcto esté ahí".
const VALID_FOR_MS = 30 * 24 * 60 * 60 * 1000;

// El shape completo que devuelve Mistral y que se guarda TAL CUAL (JSON.stringify, sin
// el wrapper) en socialflow_seasonality_cache.context — así cada agente consumidor
// (ContentGeneratorAgent/CarouselComposerAgent/ReelsAgent) interpola el JSON completo en
// su propio prompt y usa solo lo que necesita de él, en vez de que este agente decida de
// antemano qué campo le sirve a cada uno.
type SeasonalContextPayload = {
  context: string;
  hooks: string[];
  themes: string[];
  cta_suggestions: string[];
  avoid: string[];
};

// generateStructured() decora el resultado con _meta.engine — "workers-ai" en una
// respuesta real y bien parseada del modelo, "local-deterministic-stub" ante CUALQUIER
// fallo (binding de IA ausente, respuesta vacía, JSON malformado — ver
// WorkersAiLocalModel.generateStructured, que nunca lanza y siempre cae al seed). Mismo
// criterio que NicheIntelligenceCronAgent: comprobar ese flag es lo que sustituye al
// try/catch de parseo — nunca se debe hacer UPSERT del seed vacío del stub sobre un
// contexto real ya cacheado.
type SeasonalContextResult = SeasonalContextPayload & { _meta?: { engine?: string } };

function currentMonthKey(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

// Mismo patrón que WeeklyBriefingAgent.ts:60 (toLocaleDateString es-ES + timeZone UTC) —
// un nombre de mes en español es más natural para el prompt que el monthKey numérico.
function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
}

function buildSeasonalContextPrompt(niche: string, monthKey: string): string {
  const label = monthLabel(monthKey);
  return `Eres un estratega de contenido para redes sociales especializado en el nicho "${niche}" para el mercado hispanohablante (España y Latinoamérica). Genera el contexto estacional para ${label}.

Responde SOLO con un objeto JSON válido, sin markdown, sin backticks, sin comentarios ni texto fuera del JSON, con esta forma exacta:

{
  "context": "párrafo narrativo de 100-150 palabras, en español, describiendo el momento del año para el nicho ${niche} en ${label}: qué está pasando, qué tono conviene usar, y qué eventos o fechas señaladas (festividades, temporadas, campañas comerciales típicas de esta época) son relevantes",
  "hooks": ["3 a 5 hooks/aperturas de caption concretos, específicos para ${niche} en ${label} — no genéricos, listos para usar como primera línea de un post"],
  "themes": ["3 a 5 temas de contenido relevantes para ${niche} en ${label}"],
  "cta_suggestions": ["2 a 3 llamadas a la acción apropiadas para esta época del año en ${niche}"],
  "avoid": ["1 a 2 temas o tonos que NO encajan con ${niche} en ${label} y conviene evitar este mes"]
}

Responde en español. Solo el JSON, nada más.`;
}

async function upsertSeasonalContext(niche: string, monthKey: string, context: string, db: D1Database): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const validUntil = new Date(now.getTime() + VALID_FOR_MS).toISOString();

  const existing = await db
    .prepare(`SELECT id FROM socialflow_seasonality_cache WHERE niche = ? AND month_key = ? LIMIT 1`)
    .bind(niche, monthKey)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(`UPDATE socialflow_seasonality_cache SET context = ?, updated_at = ?, valid_until = ? WHERE id = ?`)
      .bind(context, nowIso, validUntil, existing.id)
      .run();
    return;
  }

  await db
    .prepare(
      `INSERT INTO socialflow_seasonality_cache (id, niche, month_key, context, created_at, updated_at, valid_until)
       VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?)`,
    )
    .bind(niche, monthKey, context, nowIso, nowIso, validUntil)
    .run();
}

// Regenera el row de contexto estacional para UN nicho, para el mes calendario en curso —
// si ya existe un row válido (niche, monthKey) con valid_until > ahora, no llama a Mistral
// en absoluto (skipped: true). Nunca lanza por una respuesta mala del modelo: loguea y
// devuelve, dejando lo que ya hubiera cacheado (mejor un mes-atrás que un row vacío) —
// mismo criterio que generateNicheAnalysis.
export async function generateSeasonalContext(niche: string, env: Env): Promise<{ ok: boolean; skipped: boolean }> {
  const db = env?.SOCIAL_DB;
  if (!db) {
    console.error("[SeasonalityAgent] SOCIAL_DB not configured, skipping", niche);
    return { ok: false, skipped: false };
  }

  const monthKey = currentMonthKey();
  const now = new Date().toISOString();

  const existing = await db
    .prepare(`SELECT id FROM socialflow_seasonality_cache WHERE niche = ? AND month_key = ? AND valid_until > ? LIMIT 1`)
    .bind(niche, monthKey, now)
    .first<{ id: string }>();

  if (existing) {
    return { ok: true, skipped: true };
  }

  const seed: SeasonalContextPayload = { context: "", hooks: [], themes: [], cta_suggestions: [], avoid: [] };
  const { data } = await defaultLocalModel.generateStructured<SeasonalContextResult>(
    { prompt: buildSeasonalContextPrompt(niche, monthKey) },
    () => seed as SeasonalContextResult,
  );

  if (data._meta?.engine !== "workers-ai") {
    console.error("[SeasonalityAgent] model generation failed or returned invalid JSON, skipping upsert", niche);
    return { ok: false, skipped: false };
  }

  // Se guarda el objeto completo serializado (sin _meta, que es un detalle interno de
  // generateStructured() y no le sirve de nada a un agente consumidor) — no solo el
  // párrafo narrativo. getSeasonalityContext() devuelve este mismo string tal cual.
  const { context, hooks, themes, cta_suggestions, avoid } = data;
  const serialized = JSON.stringify({ context, hooks, themes, cta_suggestions, avoid });

  await upsertSeasonalContext(niche, monthKey, serialized, db);
  console.log("[SeasonalityAgent] seasonal context updated", niche, monthKey);
  return { ok: true, skipped: false };
}

// Lee el contexto estacional cacheado para el mes calendario EN CURSO, para el nicho de
// texto libre del tenant — mismo patrón de normalización que getNicheIntelligence()
// (NicheIntelligenceService.ts): resolveNicheSlug() traduce el texto libre del perfil
// (ej. "Fitness y lifestyle para mujeres") al slug normalizado (ej. "fitness") sobre el
// que este cron realmente escribe filas, con la misma caché de 3 niveles (exacto →
// regex parcial → LLM) y el mismo criterio de "nunca lanza, null en cualquier fallo o
// miss" para que buildProfile() se degrade con gracia en vez de romper la generación de
// contenido. Devuelve el JSON completo como string — igual que se guardó — para que cada
// agente consumidor interpole tal cual y use solo los campos que necesite.
export async function getSeasonalityContext(
  rawNiche: string,
  env: Env,
  tenantId?: string,
  saasId?: string,
): Promise<string | null> {
  const db = env?.SOCIAL_DB;
  if (!db || !rawNiche) return null;

  try {
    const niche = await resolveNicheSlug(rawNiche, db, tenantId, saasId);
    if (!niche) return null;

    const monthKey = currentMonthKey();
    const now = new Date().toISOString();
    const row = await db
      .prepare(
        `SELECT context FROM socialflow_seasonality_cache
         WHERE niche = ? AND month_key = ? AND valid_until > ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .bind(niche, monthKey, now)
      .first<{ context: string }>();

    return row?.context ?? null;
  } catch (err) {
    console.error("[SeasonalityAgent] getSeasonalityContext failed", rawNiche, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Itera todos los nichos secuencialmente (no Promise.all) para respetar los rate limits
// de Workers AI — mismo criterio que runNicheIntelligenceCron. La mayoría de noches el
// row del mes en curso de cada nicho ya es válido (TTL de 30 días), así que este bucle es
// un escaneo rápido sin llamadas reales; solo alrededor del cambio de mes llama a Mistral,
// una vez por nicho.
export async function runSeasonalityCron(env: Env): Promise<SeasonalityCronResult[]> {
  const results: SeasonalityCronResult[] = [];

  for (const niche of NICHE_INTELLIGENCE_NICHES) {
    console.log("[SeasonalityAgent] checking niche", niche);
    try {
      const { ok, skipped } = await generateSeasonalContext(niche, env);
      results.push({ niche, ok, skipped });
    } catch (err) {
      console.error("[SeasonalityAgent] niche failed", niche, err instanceof Error ? err.message : String(err));
      results.push({ niche, ok: false, skipped: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return results;
}
