import { defaultLocalModel } from "../models/localModel";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import { getSocialFlowAccountTypeByTenant } from "@/lib/socialflow/auth/account-type";
import { getNicheIntelligence, getStyleHistory, safeParseObject, type Env } from "@/lib/socialflow/intelligence/NicheIntelligenceService";
import { getLatestPerformanceSnapshot } from "./ContentPerformanceAgent";
import { getLatestAudienceGrowth } from "./AudienceGrowthAgent";
import { getLatestOptimalPostingSchedule } from "./OptimalPostingScheduleAgent";
import { getLatestHashtagIntelligence } from "./HashtagIntelligenceAgent";
import { getLatestSentimentTrend } from "./SentimentTrendAgent";
import { env, type DracoEnv } from "@/lib/cf";

export type StrategicPlanResult = {
  monthlyObjective: string;
  priorities: string[];
  keyOpportunity: string;
  alert: string | null;
  executiveSummary: string;
};

type SynthesisFacts = {
  niche: string;
  bestFormat: string | null;
  bestDays: string[];
  recommendedHashtags: string[];
  sentimentAlert: boolean;
  sentimentTrend: string | null;
  keyOpportunityHint: string | null;
};

function buildSectionBlock(label: string, lines: string[]): string {
  const filtered = lines.filter(Boolean);
  if (!filtered.length) return `${label}: sin datos suficientes todavía.`;
  return `${label}:\n${filtered.map((l) => `- ${l}`).join("\n")}`;
}

function buildSynthesisPrompt(niche: string, accountType: string, sections: string[]): string {
  return `Eres el estratega jefe de contenido de este cliente (nicho "${niche}", cuenta tipo ${accountType}). Tienes acceso a todo lo que un sistema de inteligencia ha aprendido sobre su cuenta hasta ahora (nunca inventes cifras que no estén aquí — si una sección dice "sin datos suficientes", trátala como ausente, no la rellenes):

${sections.join("\n\n")}

Con toda esta información, sintetiza un plan estratégico para el próximo mes:
1. Un objetivo principal del mes, basado en el estado actual real del cliente.
2. Exactamente 3 prioridades de contenido concretas (formatos, temas o frecuencia).
3. Una oportunidad clave que el cliente todavía no está aprovechando.
4. Una alerta SOLO si algo real de arriba indica un problema (sentimiento negativo, fatiga de contenido, engagement cayendo) — si no hay ningún problema real, responde null.
5. Un resumen ejecutivo de 2-3 frases: dónde está el cliente y hacia dónde va.

Responde SOLO con un objeto JSON válido, sin markdown ni backticks, con esta forma exacta:
{"monthlyObjective": "...", "priorities": ["...", "...", "..."], "keyOpportunity": "...", "alert": "..." o null, "executiveSummary": "..."}

Responde todo en español.`;
}

type StrategicPlanLLMResult = {
  monthlyObjective: unknown;
  priorities: unknown[];
  keyOpportunity: unknown;
  alert: unknown;
  executiveSummary: unknown;
  _meta?: { engine?: string };
};

function buildFallbackPlan(facts: SynthesisFacts): StrategicPlanResult {
  const priorities: string[] = [];
  if (facts.bestFormat) priorities.push(`Prioriza el formato ${facts.bestFormat}, tu mejor formato histórico hasta ahora.`);
  if (facts.bestDays.length) priorities.push(`Publica los días ${facts.bestDays.join(", ")}, cuando tu audiencia más interactúa.`);
  if (facts.recommendedHashtags.length) priorities.push(`Usa hashtags como ${facts.recommendedHashtags.slice(0, 3).join(" ")} para maximizar alcance.`);
  while (priorities.length < 3) priorities.push("Publica de forma consistente para que el Cerebro siga aprendiendo de tu audiencia.");

  const alert = facts.sentimentAlert
    ? `El sentimiento en tus comentarios está ${facts.sentimentTrend ?? "empeorando"} — revisa el Intelligence Feed para más detalle.`
    : null;

  return {
    monthlyObjective: `Consolidar tu presencia en ${facts.niche} este mes con contenido consistente.`,
    priorities: priorities.slice(0, 3),
    keyOpportunity: facts.keyOpportunityHint ?? "Sigue conectando tu contenido a lo que mejor le funciona a tu audiencia real.",
    alert,
    executiveSummary: `Tu cuenta sigue construyendo presencia en ${facts.niche}. Mantén estas prioridades este mes para consolidar el avance.`,
  };
}

function isValidPlan(data: StrategicPlanLLMResult): boolean {
  return (
    typeof data.monthlyObjective === "string" && data.monthlyObjective.trim().length > 0 &&
    Array.isArray(data.priorities) && data.priorities.length > 0 &&
    typeof data.keyOpportunity === "string" && data.keyOpportunity.trim().length > 0 &&
    typeof data.executiveSummary === "string" && data.executiveSummary.trim().length > 0
  );
}

// Sintetiza los snapshots de TODOS los agentes del Cerebro para un tenant en un plan
// mensual cohesionado — 1 sola llamada a Mistral, semanal (los datos que sintetiza
// tampoco cambian a diario: la mayoría de sus fuentes son snapshots del cron diario o
// semanal). Persiste en socialcors_strategic_plan (tabla propia por tenant, migración
// 0234). Se muestra como tarjeta fija en la pestaña Inteligencia del CRM Social — fuera
// del scroll del Intelligence Feed — vía getLatestStrategicPlan.
export class StrategicPlanningAgent {
  async run(input: { tenantId: string; saasId: string; accountType?: "influencer" | "empresa" }): Promise<StrategicPlanResult | null> {
    const dracoEnv = env();
    if (!dracoEnv?.SOCIAL_DB) return null;

    const profile = await getChannelProfile(input.tenantId, input.saasId);
    if (!profile.niche) return null;

    const accountType =
      input.accountType ?? (await getSocialFlowAccountTypeByTenant(input.tenantId).catch(() => null)) ?? "influencer";

    const [perfSnapshot, growth, schedule, hashtagIntel, sentiment, nicheIntel, styleHistory] = await Promise.all([
      getLatestPerformanceSnapshot(input.tenantId, input.saasId, dracoEnv).catch(() => null),
      getLatestAudienceGrowth(input.tenantId, input.saasId, dracoEnv).catch(() => null),
      getLatestOptimalPostingSchedule(input.tenantId, input.saasId, dracoEnv).catch(() => null),
      getLatestHashtagIntelligence(input.tenantId, input.saasId, dracoEnv).catch(() => null),
      getLatestSentimentTrend(input.tenantId, input.saasId, dracoEnv).catch(() => null),
      getNicheIntelligence(profile.niche, dracoEnv, input.tenantId, input.saasId, accountType).catch(() => null),
      getStyleHistory(input.tenantId, input.saasId, dracoEnv).catch(() => []),
    ]);

    // getLatestPerformanceSnapshot es el único de los 5 que devuelve el JSON crudo sin
    // parsear (los otros 4 ya devuelven el objeto parseado) — mismo criterio que ya usa
    // chat/route.ts para leerlo.
    const perfParsed = perfSnapshot ? safeParseObject(perfSnapshot.snapshotJson) : null;
    const perfInsight = typeof perfParsed?.insight === "string" ? perfParsed.insight : null;
    const perfPatterns = perfParsed?.patterns as { bestFormat?: string | null; bestHookType?: string | null; bestHour?: number | null } | undefined;

    const styleParsed = styleHistory[0] ? safeParseObject(styleHistory[0].snapshotJson) : null;
    const styleSummary = typeof styleParsed?.summaryText === "string" ? styleParsed.summaryText : null;

    const nicheAnalysisText = typeof nicheIntel?.analysis?.analysis === "string" ? (nicheIntel.analysis.analysis as string) : null;

    const sections = [
      buildSectionBlock("Rendimiento de tus posts (ContentPerformanceAgent)", [
        perfInsight ? `Insight: ${perfInsight}` : "",
        perfPatterns?.bestFormat ? `Mejor formato histórico: ${perfPatterns.bestFormat}` : "",
      ]),
      buildSectionBlock("Audiencia (AudienceGrowthAgent)", [
        growth?.insight ? `Insight: ${growth.insight}` : "",
        growth?.recommendation ? `Recomendación: ${growth.recommendation}` : "",
      ]),
      buildSectionBlock("Ritmo de publicación (OptimalPostingScheduleAgent)", [
        schedule?.bestDays.length ? `Mejores días: ${schedule.bestDays.join(", ")}` : "",
        schedule?.weeklyScheduleRecommendation ? `Recomendación: ${schedule.weeklyScheduleRecommendation}` : "",
      ]),
      buildSectionBlock("Hashtags (HashtagIntelligenceAgent)", [
        hashtagIntel?.insight ? `Insight: ${hashtagIntel.insight}` : "",
        hashtagIntel?.overusedHashtags.length ? `Sobreusados (evitar): ${hashtagIntel.overusedHashtags.join(" ")}` : "",
      ]),
      buildSectionBlock("Sentimiento de la comunidad (SentimentTrendAgent)", [
        sentiment ? `Tendencia: ${sentiment.trend}, ratio negativo reciente: ${Math.round(sentiment.recentNegativeRatio * 100)}%` : "",
        sentiment?.topNegativeThemes.length ? `Temas negativos recurrentes: ${sentiment.topNegativeThemes.join(", ")}` : "",
      ]),
      buildSectionBlock("Tendencias del nicho", [
        nicheAnalysisText ? `Contexto: ${nicheAnalysisText}` : "",
        nicheIntel?.hooks.length ? `Hooks en tendencia: ${nicheIntel.hooks.slice(0, 5).join(" | ")}` : "",
      ]),
      buildSectionBlock("Estilo propio del cliente (StyleLearningAgent)", [styleSummary ? styleSummary : ""]),
    ];

    const facts: SynthesisFacts = {
      niche: profile.niche,
      bestFormat: perfPatterns?.bestFormat ?? null,
      bestDays: schedule?.bestDays ?? [],
      recommendedHashtags: hashtagIntel ? [...hashtagIntel.recommendedMix.niche, ...hashtagIntel.recommendedMix.trending] : [],
      sentimentAlert: sentiment?.alert ?? false,
      sentimentTrend: sentiment?.trend ?? null,
      keyOpportunityHint: growth?.recommendation ?? null,
    };
    const fallback = buildFallbackPlan(facts);

    const { data } = await defaultLocalModel.generateStructured<StrategicPlanLLMResult>(
      { prompt: buildSynthesisPrompt(profile.niche, accountType, sections), tenantId: input.tenantId, saasId: input.saasId },
      () => fallback as unknown as StrategicPlanLLMResult,
    );

    const usable = data._meta?.engine === "workers-ai" && isValidPlan(data);

    const result: StrategicPlanResult = usable
      ? {
          monthlyObjective: (data.monthlyObjective as string).trim(),
          priorities: (data.priorities as unknown[]).filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, 3),
          keyOpportunity: (data.keyOpportunity as string).trim(),
          alert: typeof data.alert === "string" && data.alert.trim() ? data.alert.trim() : null,
          executiveSummary: (data.executiveSummary as string).trim(),
        }
      : fallback;

    await upsertStrategicPlan(input.tenantId, input.saasId, JSON.stringify(result), dracoEnv);
    return result;
  }
}

// --- Persistencia (tabla propia por tenant, ver migración 0234) -------------------

async function upsertStrategicPlan(tenantId: string, saasId: string, snapshot: string, dracoEnv: DracoEnv): Promise<void> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return;

  try {
    const now = new Date().toISOString();
    const existing = await db
      .prepare(`SELECT id FROM socialcors_strategic_plan WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE socialcors_strategic_plan SET snapshot_json = ?, updated_at = ? WHERE id = ?`)
        .bind(snapshot, now, existing.id)
        .run();
      return;
    }

    await db
      .prepare(
        `INSERT INTO socialcors_strategic_plan (id, tenant_id, saas_id, snapshot_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), tenantId, saasId, snapshot, now, now)
      .run();
  } catch (err) {
    console.error("[StrategicPlanningAgent] upsertStrategicPlan failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
  }
}

// Lectura barata para la tarjeta fija del frontend y el chat — nunca vuelve a leer los
// snapshots de los otros agentes ni a llamar a Mistral, solo el plan que ya calculó el
// cron semanal.
export async function getLatestStrategicPlan(
  tenantId: string,
  saasId: string,
  dracoEnv: DracoEnv,
): Promise<StrategicPlanResult | null> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return null;

  try {
    const row = await db
      .prepare(`SELECT snapshot_json FROM socialcors_strategic_plan WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ snapshot_json: string }>();

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as StrategicPlanResult;
  } catch (err) {
    console.error("[StrategicPlanningAgent] getLatestStrategicPlan failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return null;
  }
}

export type StrategicPlanTenantOutcome = { tenantId: string; saasId: string; ok: boolean; error?: string };

// Corre semanalmente para todo tenant onboardeado — mismo patrón de enumeración que
// runViralOpportunityCron/runSeasonalOpportunityCron: nunca lanza por un tenant
// fallido, sigue con el resto.
export async function runStrategicPlanCron(cronEnv: Env): Promise<StrategicPlanTenantOutcome[]> {
  const db = cronEnv?.SOCIAL_DB;
  if (!db) return [];

  const { results: tenantRows } = await db.prepare(`SELECT DISTINCT tenant_id, saas_id FROM socialflow_profiles`).all<{
    tenant_id: string;
    saas_id: string;
  }>();

  const results: StrategicPlanTenantOutcome[] = [];
  for (const row of tenantRows ?? []) {
    try {
      await new StrategicPlanningAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id });
      results.push({ tenantId: row.tenant_id, saasId: row.saas_id, ok: true });
    } catch (err) {
      console.error("[StrategicPlanningAgent] tenant failed", row.tenant_id, err instanceof Error ? err.message : String(err));
      results.push({ tenantId: row.tenant_id, saasId: row.saas_id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
