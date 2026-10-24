import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import { resolveNicheSlug } from "@/lib/socialflow/intelligence/NicheIntelligenceService";
import { getSocialFlowAccountTypeByTenant } from "@/lib/socialflow/auth/account-type";
import { resolveSocialContext, listSaasSocialPosts } from "@/lib/socialflow/repository";
import { getLatestPerformanceSnapshot, type ContentPerformanceResult } from "./ContentPerformanceAgent";
import { env, type DracoEnv } from "@/lib/cf";

// Mismo umbral y misma razón de anonimato que MIN_TENANTS_FOR_NICHE en
// CrossTenantIntelligenceAgent.ts: por debajo de esto, un "agregado anónimo" es en la
// práctica los datos de un solo tenant con pasos extra.
const MIN_TENANTS_FOR_CROSS = 3;
const TOP_N = 3;
// Mismo criterio de ventana que ContentPerformanceAgent — para que avgCaptionLength se
// calcule sobre el mismo conjunto de posts recientes que ese agente ya analizó.
const MAX_POSTS_ANALYZED = 30;
const HOUR_GAP_THRESHOLD = 2;
const CAPTION_LENGTH_GAP_RATIO = 0.2;

export type BestPracticePatterns = {
  formats: string[];
  hookTypes: string[];
  bestHours: number[];
  avgCaptionLength: number;
};

export type BestPracticesResult = {
  topPerformerPatterns: BestPracticePatterns;
  currentPatterns: BestPracticePatterns;
  gaps: string[];
  recommendations: string[];
};

type TenantRef = { tenantId: string; saasId: string };

// written=true solo si la fila se guardó de verdad — el cron lo usa como rows_written
// (antes contaba tenants recorridos: "7 filas" con la tabla vacía). skippedReason explica
// los casos en que no hay nada que guardar, casi siempre el gate de anonimato.
export type BestPracticesRunOutcome = { result: BestPracticesResult | null; written: boolean; skippedReason?: string };

function skipped(reason: string): BestPracticesRunOutcome {
  return { result: null, written: false, skippedReason: reason };
}

function parsePerformanceSnapshot(json: string): ContentPerformanceResult | null {
  try {
    const parsed = JSON.parse(json) as Partial<ContentPerformanceResult>;
    if (!Array.isArray(parsed.topPosts) || !parsed.patterns) return null;
    return parsed as ContentPerformanceResult;
  } catch {
    return null;
  }
}

// Moda primero, luego el resto por frecuencia descendente — nunca se guarda qué tenant
// aportó cada valor, solo la lista de valores agregados (igual que
// NicheEngagementPatterns nunca expone identidad).
function dedupeByFrequency<T>(values: T[]): T[] {
  const counts = new Map<T, number>();
  const order: T[] = [];
  for (const v of values) {
    if (!counts.has(v)) order.push(v);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return order.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
}

async function avgCaptionLengthFor(tenantId: string, saasId: string): Promise<{ avg: number; postCount: number }> {
  const ctx = await resolveSocialContext({ tenantId, saasId });
  const allPosts = await listSaasSocialPosts(ctx);
  const published = allPosts
    .filter((p) => p.status === "POSTED" || p.status === "PUBLISHED")
    .sort((a, b) =>
      new Date(b.postedAt ?? b.scheduledAt ?? b.createdAt).getTime()
      - new Date(a.postedAt ?? a.scheduledAt ?? a.createdAt).getTime(),
    )
    .slice(0, MAX_POSTS_ANALYZED);

  if (!published.length) return { avg: 0, postCount: 0 };
  const totalLength = published.reduce((sum, p) => sum + p.body.length, 0);
  return { avg: totalLength / published.length, postCount: published.length };
}

// Reimplementación acotada de groupTenantsByNiche (CrossTenantIntelligenceAgent.ts —
// no exportada de allí): en vez de agrupar TODOS los nichos, solo nos interesan los
// tenants que matchean el (niche, accountType) del tenant actual. Mismo criterio
// "listar todo, filtrar en memoria" ya aceptado a los volúmenes actuales de tenants.
async function findNicheMatchedCandidates(
  db: D1Database,
  nicheSlug: string,
  accountType: "influencer" | "empresa",
  self: TenantRef,
): Promise<TenantRef[]> {
  const { results: tenantRows } = await db
    .prepare(`SELECT DISTINCT tenant_id, saas_id FROM socialflow_profiles`)
    .all<{ tenant_id: string; saas_id: string }>();

  const matches: TenantRef[] = [];
  for (const row of tenantRows ?? []) {
    if (row.tenant_id === self.tenantId && row.saas_id === self.saasId) continue;
    try {
      const candidateProfile = await getChannelProfile(row.tenant_id, row.saas_id);
      if (!candidateProfile.niche) continue;
      const slug = await resolveNicheSlug(candidateProfile.niche, db, row.tenant_id, row.saas_id);
      if (slug !== nicheSlug) continue;
      const candidateAccountType = (await getSocialFlowAccountTypeByTenant(row.tenant_id).catch(() => null)) ?? "influencer";
      if (candidateAccountType !== accountType) continue;
      matches.push({ tenantId: row.tenant_id, saasId: row.saas_id });
    } catch (err) {
      console.error("[BestPracticesAgent] candidate resolution failed", row.tenant_id, err instanceof Error ? err.message : String(err));
    }
  }
  return matches;
}

// Orquestador cross-tenant (mismo espíritu que CrossTenantIntelligenceAgent, pero
// reutilizando snapshots ya persistidos por ContentPerformanceAgent en vez de recalcular
// desde posts crudos): identifica los TOP 3 tenants con mayor engagement compuesto
// dentro del mismo nicho+accountType del cliente, agrega sus patrones (formato, tipo de
// hook, hora, longitud de caption) de forma anónima, y los compara contra el propio
// historial del cliente para generar recomendaciones accionables. Nunca expone
// tenantId/saasId ni contenido de otros tenants — solo agregados numéricos. Persiste en
// socialcors_best_practices (tabla propia por tenant, migración 0239).
export class BestPracticesAgent {
  async run(input: { tenantId: string; saasId: string; accountType?: "influencer" | "empresa" }): Promise<BestPracticesRunOutcome> {
    const dracoEnv = env();
    if (!dracoEnv?.SOCIAL_DB) return skipped("SOCIAL_DB_UNAVAILABLE");
    const db = dracoEnv.SOCIAL_DB;

    const profile = await getChannelProfile(input.tenantId, input.saasId);
    if (!profile.niche) return skipped("NO_NICHE");

    const nicheSlug = await resolveNicheSlug(profile.niche, db, input.tenantId, input.saasId).catch(() => "");
    if (!nicheSlug) return skipped("NICHE_NOT_RESOLVED");

    const accountType =
      input.accountType ?? (await getSocialFlowAccountTypeByTenant(input.tenantId).catch(() => null)) ?? "influencer";

    const candidates = await findNicheMatchedCandidates(db, nicheSlug, accountType, { tenantId: input.tenantId, saasId: input.saasId });

    const candidatesWithScore: Array<{ tenant: TenantRef; result: ContentPerformanceResult; compositeScore: number }> = [];
    for (const candidate of candidates) {
      const snapshot = await getLatestPerformanceSnapshot(candidate.tenantId, candidate.saasId, dracoEnv).catch(() => null);
      if (!snapshot) continue;
      const parsed = parsePerformanceSnapshot(snapshot.snapshotJson);
      if (!parsed || !parsed.topPosts.length) continue;
      const compositeScore = parsed.topPosts.reduce((sum, p) => sum + p.score, 0) / parsed.topPosts.length;
      candidatesWithScore.push({ tenant: candidate, result: parsed, compositeScore });
    }

    // Gate de anonimato: por debajo de MIN_TENANTS_FOR_CROSS no hay suficiente masa
    // cross-tenant para agregar sin que el "top 3" sea, en la práctica, identificable.
    if (candidatesWithScore.length < MIN_TENANTS_FOR_CROSS) {
      return skipped(`ONLY_${candidatesWithScore.length}_PEERS_WITH_PERFORMANCE_DATA_MIN_${MIN_TENANTS_FOR_CROSS}`);
    }

    const topPerformers = [...candidatesWithScore].sort((a, b) => b.compositeScore - a.compositeScore).slice(0, TOP_N);

    const ownSnapshot = await getLatestPerformanceSnapshot(input.tenantId, input.saasId, dracoEnv).catch(() => null);
    const ownResult = ownSnapshot ? parsePerformanceSnapshot(ownSnapshot.snapshotJson) : null;
    if (!ownResult) return skipped("NO_OWN_PERFORMANCE_SNAPSHOT");

    const [topCaptionStats, ownCaptionStats] = await Promise.all([
      Promise.all(topPerformers.map((p) => avgCaptionLengthFor(p.tenant.tenantId, p.tenant.saasId))),
      avgCaptionLengthFor(input.tenantId, input.saasId),
    ]);

    const totalTopPosts = topCaptionStats.reduce((sum, s) => sum + s.postCount, 0);
    const topAvgCaptionLength =
      totalTopPosts > 0 ? topCaptionStats.reduce((sum, s) => sum + s.avg * s.postCount, 0) / totalTopPosts : 0;

    const topPerformerPatterns: BestPracticePatterns = {
      formats: dedupeByFrequency(topPerformers.map((p) => p.result.patterns.bestFormat).filter((v): v is string => Boolean(v))),
      hookTypes: dedupeByFrequency(topPerformers.map((p) => p.result.patterns.bestHookType).filter((v): v is string => Boolean(v))),
      bestHours: dedupeByFrequency(topPerformers.map((p) => p.result.patterns.bestHour).filter((v): v is number => v !== null)),
      avgCaptionLength: Math.round(topAvgCaptionLength),
    };

    const currentPatterns: BestPracticePatterns = {
      formats: ownResult.patterns.bestFormat ? [ownResult.patterns.bestFormat] : [],
      hookTypes: ownResult.patterns.bestHookType ? [ownResult.patterns.bestHookType] : [],
      bestHours: ownResult.patterns.bestHour !== null ? [ownResult.patterns.bestHour] : [],
      avgCaptionLength: Math.round(ownCaptionStats.avg),
    };

    const topFormat = topPerformerPatterns.formats[0] ?? null;
    const topHookType = topPerformerPatterns.hookTypes[0] ?? null;
    const topHour = topPerformerPatterns.bestHours[0] ?? null;
    const yourFormat = currentPatterns.formats[0] ?? null;
    const yourHookType = currentPatterns.hookTypes[0] ?? null;
    const yourHour = currentPatterns.bestHours[0] ?? null;

    const formatDiffers = Boolean(topFormat && yourFormat && topFormat !== yourFormat);
    const hookDiffers = Boolean(topHookType && yourHookType && topHookType !== yourHookType);
    const hourDiffers = topHour !== null && yourHour !== null && Math.abs(topHour - yourHour) >= HOUR_GAP_THRESHOLD;
    const captionDiffers =
      topPerformerPatterns.avgCaptionLength > 0 &&
      currentPatterns.avgCaptionLength > 0 &&
      Math.abs(topPerformerPatterns.avgCaptionLength - currentPatterns.avgCaptionLength) /
          Math.max(topPerformerPatterns.avgCaptionLength, currentPatterns.avgCaptionLength) >=
        CAPTION_LENGTH_GAP_RATIO;

    const gaps: string[] = [];
    if (formatDiffers) gaps.push(`Los mejores creadores de ${profile.niche} publican mayormente en formato ${topFormat} — tú publicas mayormente en formato ${yourFormat}.`);
    if (hookDiffers) gaps.push(`Los mejores creadores de ${profile.niche} usan hooks tipo "${topHookType}" — tú usas mayormente hooks tipo "${yourHookType}".`);
    if (hourDiffers) gaps.push(`Los mejores creadores de ${profile.niche} publican cerca de las ${topHour}h UTC — tú publicas cerca de las ${yourHour}h UTC.`);
    if (captionDiffers) {
      const longer = topPerformerPatterns.avgCaptionLength > currentPatterns.avgCaptionLength;
      gaps.push(
        `Los mejores creadores de ${profile.niche} escriben captions ${longer ? "más largos" : "más cortos"} que los tuyos (~${topPerformerPatterns.avgCaptionLength} vs. ~${currentPatterns.avgCaptionLength} caracteres).`,
      );
    }

    const recommendations: string[] = [];
    if (!gaps.length) {
      recommendations.push("Ya sigues los patrones de los mejores creadores de tu nicho — sigue así.");
    } else {
      if (formatDiffers || hookDiffers || hourDiffers) {
        const topParts = [
          topFormat ? `formato ${topFormat}` : null,
          hookDiffers && topHookType ? `hooks tipo "${topHookType}"` : null,
          hourDiffers && topHour !== null ? `alrededor de las ${topHour}:00` : null,
        ].filter((x): x is string => Boolean(x));
        recommendations.push(`Los mejores creadores de ${profile.niche} publican en ${topParts.join(", ")} — prueba acercar tu estrategia a ese patrón.`);
      }
      if (captionDiffers) {
        const longer = topPerformerPatterns.avgCaptionLength > currentPatterns.avgCaptionLength;
        recommendations.push(`Ajusta la longitud de tus captions: los mejores creadores de ${profile.niche} escriben captions ${longer ? "más largos" : "más cortos"} que los tuyos.`);
      }
    }

    const result: BestPracticesResult = { topPerformerPatterns, currentPatterns, gaps, recommendations };

    const written = await upsertBestPractices(input.tenantId, input.saasId, JSON.stringify(result), dracoEnv);
    return written ? { result, written } : { result, written, skippedReason: "UPSERT_FAILED" };
  }
}

// --- Persistencia (tabla propia por tenant, ver migración 0239) -------------------

async function upsertBestPractices(tenantId: string, saasId: string, snapshot: string, dracoEnv: DracoEnv): Promise<boolean> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return false;

  try {
    const now = new Date().toISOString();
    const existing = await db
      .prepare(`SELECT id FROM socialcors_best_practices WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE socialcors_best_practices SET snapshot_json = ?, updated_at = ? WHERE id = ?`)
        .bind(snapshot, now, existing.id)
        .run();
      return true;
    }

    await db
      .prepare(
        `INSERT INTO socialcors_best_practices (id, tenant_id, saas_id, snapshot_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), tenantId, saasId, snapshot, now, now)
      .run();
    return true;
  } catch (err) {
    console.error("[BestPracticesAgent] upsertBestPractices failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return false;
  }
}

// Lectura barata para el chat — nunca vuelve a leer los snapshots de otros tenants,
// solo el snapshot que ya calculó el cron semanal.
export async function getLatestBestPractices(
  tenantId: string,
  saasId: string,
  dracoEnv: DracoEnv,
): Promise<BestPracticesResult | null> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return null;

  try {
    const row = await db
      .prepare(`SELECT snapshot_json FROM socialcors_best_practices WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ snapshot_json: string }>();

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as BestPracticesResult;
  } catch (err) {
    console.error("[BestPracticesAgent] getLatestBestPractices failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return null;
  }
}

export type BestPracticesTenantOutcome = { tenantId: string; saasId: string; ok: boolean; written: boolean; skippedReason?: string; error?: string };

// Corre semanalmente para todo tenant onboardeado — mismo patrón de enumeración que
// runStrategicPlanCron: nunca lanza por un tenant fallido, sigue con el resto.
export async function runBestPracticesCron(cronEnv: DracoEnv): Promise<BestPracticesTenantOutcome[]> {
  const db = cronEnv?.SOCIAL_DB;
  if (!db) return [];

  const { results: tenantRows } = await db.prepare(`SELECT DISTINCT tenant_id, saas_id FROM socialflow_profiles`).all<{
    tenant_id: string;
    saas_id: string;
  }>();

  const results: BestPracticesTenantOutcome[] = [];
  for (const row of tenantRows ?? []) {
    try {
      const outcome = await new BestPracticesAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id });
      results.push({ tenantId: row.tenant_id, saasId: row.saas_id, ok: true, written: outcome.written, skippedReason: outcome.skippedReason });
    } catch (err) {
      console.error("[BestPracticesAgent] tenant failed", row.tenant_id, err instanceof Error ? err.message : String(err));
      results.push({ tenantId: row.tenant_id, saasId: row.saas_id, ok: false, written: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
