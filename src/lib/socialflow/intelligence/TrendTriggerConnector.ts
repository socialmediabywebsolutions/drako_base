import { safeParseObject, type Env } from "./NicheIntelligenceService";
import { extractTrendSignals, type TrendSignals } from "./TrendKeywordAgent";
import { isTenantAllowedInPrivatePilot } from "../private-pilot";
import { getSocialFlowAccountTypeByTenant } from "../auth/account-type";

// Nivel 3 — flujo autónomo tendencia → imagen+texto → publicado, SOLO para esta
// cuenta interna (ver auditoría de piezas existentes). Hardcodeado a propósito: no es
// una feature multi-tenant todavía, es un piloto de un único tenant propio (775444ce,
// "Socialcors - cuenta oficial" en internal_accounts). Ampliarlo a más tenants
// requiere decidir de nuevo el umbral y la ventana de veto por tenant, no solo
// generalizar este archivo.
const TREND_TRIGGER_TENANT = {
  tenantId: "775444ce-5ed0-4e69-864f-dc3e0d886817",
  saasId: "socialflow",
  niche: "marketing",
  tone: "profesional y cercano",
} as const;

// Calibrado contra los 9 nichos con trendSignals reales en producción al momento del
// diseño (rango observado: 10 en nichos con solo ruido de globalTrends, 50-100 en
// nichos con señal real de YouTube/Reddit) — ver conversación de diseño. Ajustable:
// registrar finalScore aunque no dispare (no implementado aún) antes de subir/bajar.
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
  | { ok: true; triggered: false; reason: string }
  | { ok: true; triggered: true; campaignId: string; score: number }
  | { ok: false; error: string };

// Se llama en cada corrida de /api/cron/social/trend-keywords (cada ~20min),
// independientemente de qué nicho haya tocado esa corrida — lee directo la fila del
// nicho del tenant interno. Nunca lanza: cualquier fallo se captura y se reporta como
// resultado, para que el cron de trend-keywords nunca degrade su propia respuesta por
// culpa de este bolt-on.
export async function runTrendTriggerConnector(env: Env): Promise<TrendTriggerResult> {
  const db = env?.SOCIAL_DB;
  if (!db) return { ok: true, triggered: false, reason: "SOCIAL_DB_UNAVAILABLE" };

  try {
    if (isAiGenerationDisabled()) {
      return { ok: true, triggered: false, reason: "AI_DISABLED" };
    }
    if (!isTenantAllowedInPrivatePilot(TREND_TRIGGER_TENANT.tenantId, env)) {
      return { ok: true, triggered: false, reason: "PRIVATE_PILOT_TENANT_NOT_ALLOWED" };
    }

    // Cerebro Socialcors — desde la migración 0224 hay 2 filas por nicho (una por
    // accountType); sin este filtro el LIMIT 1 de abajo devolvía una fila arbitraria.
    // Resuelto dinámicamente (no hardcodeado) por el mismo motivo que
    // CrossTenantIntelligenceAgent: no asumir qué accountType tiene este tenant.
    const accountType = (await getSocialFlowAccountTypeByTenant(TREND_TRIGGER_TENANT.tenantId).catch(() => null)) ?? "influencer";

    const nicheRow = await db
      .prepare(`SELECT analysis_json FROM socialcors_niche_intelligence WHERE niche = ? AND account_type = ? LIMIT 1`)
      .bind(TREND_TRIGGER_TENANT.niche, accountType)
      .first<{ analysis_json: string }>();
    if (!nicheRow) return { ok: true, triggered: false, reason: "NICHE_ROW_NOT_FOUND" };

    const signals = extractTrendSignals(safeParseObject(nicheRow.analysis_json));
    if (!signals) return { ok: true, triggered: false, reason: "NO_TREND_SIGNALS_YET" };

    const ageHours = (Date.now() - new Date(signals.fetchedAt).getTime()) / (1000 * 60 * 60);
    const freshness = freshnessMultiplier(ageHours);
    if (freshness === 0) {
      return { ok: true, triggered: false, reason: `STALE_SIGNAL_${Math.round(ageHours)}H` };
    }

    const rawBreakdown = computeRawScore(signals);
    const finalScore = Math.round(rawBreakdown.rawScore * freshness);
    if (finalScore < SCORE_THRESHOLD) {
      return { ok: true, triggered: false, reason: `SCORE_BELOW_THRESHOLD_${finalScore}` };
    }

    // Idempotencia por lectura: ¿ya se disparó sobre este mismo snapshot
    // (mismo trend_fetched_at)? El índice único de la tabla es el backstop duro ante
    // una condición de carrera; este SELECT evita el intento de INSERT en el caso
    // normal (no-carrera), que es casi siempre.
    const alreadyTriggered = await db
      .prepare(`SELECT id FROM socialcors_trend_triggers WHERE tenant_id = ? AND niche = ? AND trend_fetched_at = ? LIMIT 1`)
      .bind(TREND_TRIGGER_TENANT.tenantId, TREND_TRIGGER_TENANT.niche, signals.fetchedAt)
      .first<{ id: string }>();
    if (alreadyTriggered) {
      return { ok: true, triggered: false, reason: "ALREADY_TRIGGERED_FOR_THIS_SNAPSHOT" };
    }

    const queue = env?.SOCIALFLOW_AI_QUEUE;
    if (!queue) {
      return { ok: true, triggered: false, reason: "SOCIALFLOW_AI_QUEUE_UNAVAILABLE" };
    }

    // Prefijo ai_campaign_ (no trend_campaign_ ni otro) a propósito: repository.ts
    // approvePost() corrige el provider a INSTAGRAM solo cuando
    // campaignId.startsWith("ai_campaign_") — perder el prefijo rompería esa
    // corrección de compatibilidad en silencio.
    const campaignId = `ai_campaign_trend_${Date.now()}`;
    const breakdown: ScoreBreakdown = { ...rawBreakdown, freshnessMultiplier: freshness, ageHours: Math.round(ageHours * 10) / 10 };

    try {
      await db
        .prepare(
          `INSERT INTO socialcors_trend_triggers
             (id, tenant_id, saas_id, niche, trend_score, score_breakdown_json, trend_fetched_at,
              trend_snapshot_json, campaign_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'TRIGGERED', ?)`,
        )
        .bind(
          generateUuid(),
          TREND_TRIGGER_TENANT.tenantId,
          TREND_TRIGGER_TENANT.saasId,
          TREND_TRIGGER_TENANT.niche,
          finalScore,
          JSON.stringify(breakdown),
          signals.fetchedAt,
          JSON.stringify(signals),
          campaignId,
          new Date().toISOString(),
        )
        .run();
    } catch (insertErr) {
      // Incluye el constraint único perdiendo una condición de carrera, pero también
      // cualquier otro fallo de escritura — en ambos casos, no se debe encolar nada.
      return { ok: true, triggered: false, reason: `TRIGGER_INSERT_FAILED: ${insertErr instanceof Error ? insertErr.message : String(insertErr)}` };
    }

    // Sin provider explícito — mismo criterio que el productor existente
    // (ai/generate/route.ts), que tampoco lo manda: persistToDb() ya cae a
    // "INSTAGRAM" por defecto cuando input.provider es undefined.
    await queue.send({
      type: "campaign",
      tenantId: TREND_TRIGGER_TENANT.tenantId,
      saasId: TREND_TRIGGER_TENANT.saasId,
      niche: TREND_TRIGGER_TENANT.niche,
      tone: TREND_TRIGGER_TENANT.tone,
      frequencyPerWeek: 1,
      campaignId,
    });

    return { ok: true, triggered: true, campaignId, score: finalScore };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
