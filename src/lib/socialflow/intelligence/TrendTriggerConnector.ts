import { type Env, getNicheIntelligence } from "./NicheIntelligenceService";
import { extractTrendSignals, type TrendSignals } from "./TrendKeywordAgent";
import { isTenantAllowedInPrivatePilot } from "../private-pilot";
import { getSocialFlowAccountTypeByTenant } from "../auth/account-type";
import { getChannelProfile } from "../profile/repository";

// Nivel 3 — flujo autónomo tendencia → imagen+texto → publicado. Generalizado para
// calcular y persistir el score de TODOS los tenants activos (antes: solo el tenant
// piloto interno 775444ce, hardcodeado). El gate de private pilot ya NO bloquea el
// cálculo/persistencia del score — solo bloquea la parte de AUTO-PUBLICACIÓN
// (queue.send más abajo), para que el score sea visible en "¿Qué creo hoy?" incluso
// para tenants fuera de la allowlist del piloto.
const DEFAULT_TONE = "profesional y cercano";

// Calibrado contra los 9 nichos con trendSignals reales en producción al momento del
// diseño original (rango observado: 10 en nichos con solo ruido de globalTrends,
// 50-100 en nichos con señal real de YouTube/Reddit) — ver conversación de diseño.
const SCORE_THRESHOLD = 70;

type ScoreBreakdown = {
  hooksCount: number;
  redditCount: number;
  trendsCount: number;
  rawScore: number;
  freshnessMultiplier: number;
  ageHours: number;
};

// globalTrends es una lista genérica de tendencias de búsqueda, NO específica del
// nicho (confirmado: entradas idénticas aparecen en nichos sin relación entre sí) —
// por eso pesa solo 0.10. redditTopics son títulos de discusión reales del nicho —
// la señal más específica, pesa 0.50. youtubeHooks son hooks reales pero con mucho
// hashtag spam genérico — peso intermedio, 0.40.
function computeRawScore(signals: TrendSignals): Omit<ScoreBreakdown, "freshnessMultiplier" | "ageHours"> {
  const hooksCount = signals.youtubeHooks.length;
  const redditCount = signals.redditTopics.length;
  const trendsCount = signals.globalTrends.length;
  const hooksRatio = Math.min(hooksCount, 10) / 10;
  const redditRatio = Math.min(redditCount, 10) / 10;
  const trendsRatio = Math.min(trendsCount, 10) / 10;
  const rawScore = Math.round(100 * (0.4 * hooksRatio + 0.5 * redditRatio + 0.1 * trendsRatio));
  return { hooksCount, redditCount, trendsCount, rawScore };
}

// Sin esto, una tendencia de hace 20h (posible tras un salto grande en el
// round-robin de TrendKeywordAgent) contaría igual que una de hace 5 minutos.
function freshnessMultiplier(ageHours: number): number {
  if (ageHours <= 2) return 1;
  if (ageHours <= 6) return 0.7;
  if (ageHours <= 12) return 0.4;
  if (ageHours <= 24) return 0.15;
  return 0;
}

// Mismo patrón que generate/route.ts y regenerate/route.ts: SOCIALFLOW_DISABLE_AI
// solo se expone vía process.env (Vars de wrangler), nunca vía el binding DracoEnv —
// no está declarado en DracoEnv, así que no se puede leer desde `env`.
function isAiGenerationDisabled(): boolean {
  const raw = typeof process !== "undefined" ? process.env.SOCIALFLOW_DISABLE_AI : undefined;
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

// Mismo helper local que ya se repite en cada repository.ts del monorepo (ver
// src/lib/socialflow/repository.ts:32) — no hay un export compartido para esto.
function generateUuid(): string {
  try {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export type TrendTriggerResult =
  | { ok: true; triggered: false; reason: string; tenantId: string; niche: string; score?: number }
  | { ok: true; triggered: true; campaignId: string; score: number; tenantId: string; niche: string }
  | { ok: false; error: string; tenantId: string };

export type TrendTriggerBatchResult = {
  ok: boolean;
  processed: number;
  triggered: number;
  belowThreshold: number;
  results: TrendTriggerResult[];
  error?: string;
};

type ActiveTenant = { tenantId: string; saasId: string };

// "Tenant activo" = tenant con al menos una cuenta social de socialflow no
// desconectada — mismo criterio que ya usa cron/social/comments/route.ts para
// enumerar tenants a procesar en cada corrida.
async function listActiveTenants(db: NonNullable<Env["SOCIAL_DB"]>): Promise<ActiveTenant[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT tenant_id, saas_id FROM saas_social_accounts
       WHERE saas_id = 'socialflow' AND status != 'DISCONNECTED'`,
    )
    .all<{ tenant_id: string; saas_id: string }>();
  return (results ?? []).map((row) => ({ tenantId: row.tenant_id, saasId: row.saas_id }));
}

// Calcula y persiste el score de UN tenant. Nunca lanza: cualquier fallo se captura y
// se reporta como resultado, para que un tenant con datos rotos nunca tumbe la corrida
// completa ni degrade el resultado de los demás tenants de este mismo batch.
async function computeAndPersistTrendScore(
  env: Env,
  db: NonNullable<Env["SOCIAL_DB"]>,
  tenant: ActiveTenant,
): Promise<TrendTriggerResult> {
  const { tenantId, saasId } = tenant;
  try {
    const [profile, accountType] = await Promise.all([
      getChannelProfile(tenantId, saasId).catch(() => null),
      getSocialFlowAccountTypeByTenant(tenantId).catch(() => null),
    ]);

    const niche = profile?.niche?.trim();
    if (!niche) {
      return { ok: true, triggered: false, reason: "NICHE_NOT_CONFIGURED", tenantId, niche: "" };
    }

    // getNicheIntelligence resuelve el slug normalizado (con caché en el perfil, ver
    // resolveNicheSlug en NicheIntelligenceService.ts) y lee la fila cross-tenant
    // compartida de socialcors_niche_intelligence para ese (niche, accountType) — el
    // mismo texto libre de nicho puede matchear la misma fila para varios tenants.
    const intel = await getNicheIntelligence(niche, env, tenantId, saasId, accountType ?? "influencer");
    if (!intel) return { ok: true, triggered: false, reason: "NICHE_ROW_NOT_FOUND", tenantId, niche };

    const signals = extractTrendSignals(intel.analysis);
    if (!signals) return { ok: true, triggered: false, reason: "NO_TREND_SIGNALS_YET", tenantId, niche };

    const ageHours = (Date.now() - new Date(signals.fetchedAt).getTime()) / (1000 * 60 * 60);
    const freshness = freshnessMultiplier(ageHours);
    if (freshness === 0) {
      return { ok: true, triggered: false, reason: `STALE_SIGNAL_${Math.round(ageHours)}H`, tenantId, niche };
    }

    const rawBreakdown = computeRawScore(signals);
    const finalScore = Math.round(rawBreakdown.rawScore * freshness);
    const breakdown: ScoreBreakdown = { ...rawBreakdown, freshnessMultiplier: freshness, ageHours: Math.round(ageHours * 10) / 10 };

    // Idempotencia por lectura: ¿ya se persistió sobre este mismo snapshot (mismo
    // trend_fetched_at) para este tenant? El índice único de la tabla es el backstop
    // duro ante una condición de carrera; este SELECT evita el intento de INSERT en el
    // caso normal (no-carrera), que es casi siempre. Ahora también cubre
    // BELOW_THRESHOLD, no solo TRIGGERED — antes de este cambio esas filas nunca se
    // guardaban, así que no había nada que deduplicar para ellas.
    const alreadyPersisted = await db
      .prepare(`SELECT id FROM socialcors_trend_triggers WHERE tenant_id = ? AND niche = ? AND trend_fetched_at = ? LIMIT 1`)
      .bind(tenantId, niche, signals.fetchedAt)
      .first<{ id: string }>();
    if (alreadyPersisted) {
      return { ok: true, triggered: false, reason: "ALREADY_PERSISTED_FOR_THIS_SNAPSHOT", tenantId, niche, score: finalScore };
    }

    const belowThreshold = finalScore < SCORE_THRESHOLD;
    // Prefijo ai_campaign_ (no trend_campaign_ ni otro) a propósito cuando SÍ dispara:
    // repository.ts approvePost() corrige el provider a INSTAGRAM solo cuando
    // campaignId.startsWith("ai_campaign_") — perder el prefijo rompería esa
    // corrección de compatibilidad en silencio. Cuando NO dispara, campaign_id es NOT
    // NULL en el schema (migración 0222) pero no hay campaña real que referenciar —
    // se guarda un id sin ese prefijo para que nunca se confunda con uno real.
    const campaignId = belowThreshold ? `scored_only_${generateUuid()}` : `ai_campaign_trend_${Date.now()}_${tenantId.slice(0, 8)}`;
    const status = belowThreshold ? "BELOW_THRESHOLD" : "TRIGGERED";

    try {
      await db
        .prepare(
          `INSERT INTO socialcors_trend_triggers
             (id, tenant_id, saas_id, niche, trend_score, score_breakdown_json, trend_fetched_at,
              trend_snapshot_json, campaign_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          generateUuid(),
          tenantId,
          saasId,
          niche,
          finalScore,
          JSON.stringify(breakdown),
          signals.fetchedAt,
          JSON.stringify(signals),
          campaignId,
          status,
          new Date().toISOString(),
        )
        .run();
    } catch (insertErr) {
      // Incluye el constraint único perdiendo una condición de carrera, pero también
      // cualquier otro fallo de escritura — en ambos casos, no se debe encolar nada.
      return {
        ok: true,
        triggered: false,
        reason: `TRIGGER_INSERT_FAILED: ${insertErr instanceof Error ? insertErr.message : String(insertErr)}`,
        tenantId,
        niche,
      };
    }

    if (belowThreshold) {
      return { ok: true, triggered: false, reason: `SCORE_BELOW_THRESHOLD_${finalScore}`, tenantId, niche, score: finalScore };
    }

    // AUTO-PUBLICACIÓN: el score ya quedó persistido arriba independientemente de este
    // gate — isTenantAllowedInPrivatePilot solo decide si esta tendencia dispara una
    // campaña real en cola, no si el score existe o es visible.
    if (!isTenantAllowedInPrivatePilot(tenantId, env)) {
      return { ok: true, triggered: false, reason: "PRIVATE_PILOT_TENANT_NOT_ALLOWED_FOR_AUTOPUBLISH", tenantId, niche, score: finalScore };
    }

    const queue = env?.SOCIALFLOW_AI_QUEUE;
    if (!queue) {
      return { ok: true, triggered: false, reason: "SOCIALFLOW_AI_QUEUE_UNAVAILABLE", tenantId, niche, score: finalScore };
    }

    // Sin provider explícito — mismo criterio que el productor existente
    // (ai/generate/route.ts), que tampoco lo manda: persistToDb() ya cae a
    // "INSTAGRAM" por defecto cuando input.provider es undefined.
    await queue.send({
      type: "campaign",
      tenantId,
      saasId,
      niche,
      tone: profile?.toneOfVoice?.trim() || DEFAULT_TONE,
      frequencyPerWeek: 1,
      campaignId,
    });

    return { ok: true, triggered: true, campaignId, score: finalScore, tenantId, niche };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), tenantId };
  }
}

// Se llama en cada corrida de /api/cron/social/trend-keywords (cada ~20min),
// independientemente de qué nicho(s) haya tocado esa corrida — enumera todos los
// tenants activos y calcula/persiste el score de cada uno. Nunca lanza: cualquier
// fallo por tenant se captura y se reporta como resultado individual, para que el
// cron de trend-keywords nunca degrade su propia respuesta por culpa de este bolt-on.
export async function runTrendTriggerConnector(env: Env): Promise<TrendTriggerBatchResult> {
  const db = env?.SOCIAL_DB;
  if (!db) return { ok: true, processed: 0, triggered: 0, belowThreshold: 0, results: [] };

  if (isAiGenerationDisabled()) {
    return { ok: true, processed: 0, triggered: 0, belowThreshold: 0, results: [] };
  }

  let tenants: ActiveTenant[];
  try {
    tenants = await listActiveTenants(db);
  } catch (err) {
    return {
      ok: false,
      processed: 0,
      triggered: 0,
      belowThreshold: 0,
      results: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const results: TrendTriggerResult[] = [];
  let triggered = 0;
  let belowThreshold = 0;

  for (const tenant of tenants) {
    const result = await computeAndPersistTrendScore(env, db, tenant);
    results.push(result);
    if (result.ok && result.triggered) triggered++;
    else if (result.ok && !result.triggered && result.reason.startsWith("SCORE_BELOW_THRESHOLD_")) belowThreshold++;
  }

  return { ok: true, processed: tenants.length, triggered, belowThreshold, results };
}
