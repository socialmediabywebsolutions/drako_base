import { getSocialFlowAccountTypeByTenant } from "@/lib/socialflow/auth/account-type";
import { getLatestAudienceGrowth } from "./AudienceGrowthAgent";
import { getLatestSeasonalOpportunities } from "./SeasonalOpportunityAgent";
import { getLatestSentimentTrend } from "./SentimentTrendAgent";
import { seedFeedItems, dismissFeedItemsBySource } from "@/lib/socialflow/intelligence/repository";
import type { IntelligenceFeedPriority } from "@/lib/socialflow/intelligence/types";
import { env, type DracoEnv } from "@/lib/cf";

const NEAR_TERM_DAYS = 14;
const SOURCE = "revenue_opportunity";

export type RevenueOpportunitySignals = {
  audienceActive: boolean;
  seasonalEvent: string | null;
  sentimentOk: boolean;
};

export type RevenueOpportunityResult = {
  opportunityScore: number;
  signals: RevenueOpportunitySignals;
  recommendation: string;
};

// Orquestador puramente aritmético (sin llamadas a Mistral, igual que
// ChurnPredictionAgent) que cruza tres snapshots ya calculados por otros agentes del
// Cerebro para decidir si es buen momento para que un cliente empresa lance una
// promoción:
// - AudienceGrowthAgent: ¿hay posts recientes con alto engagement (audiencia activa)?
// - SeasonalOpportunityAgent: ¿se acerca un evento estacional relevante (≤14 días)?
// - SentimentTrendAgent: ¿el sentimiento de los comentarios está sano?
// Regla dura: sentimiento negativo/en alerta descarta cualquier oportunidad, nunca es
// solo una señal más del score — jamás se recomienda lanzar una promo con comentarios
// negativos. Solo aplica a accountType="empresa" (un influencer no "lanza promociones"
// de empresa); para influencer devuelve null sin persistir nada. Persiste en
// socialcors_revenue_opportunities (tabla propia por tenant, migración 0238) para que
// el chat lea el snapshot ya calculado en vez de recalcular en cada mensaje.
export class RevenueOpportunityAgent {
  async run(input: { tenantId: string; saasId: string; accountType?: "influencer" | "empresa" }): Promise<RevenueOpportunityResult | null> {
    const dracoEnv = env();
    if (!dracoEnv?.SOCIAL_DB) return null;

    const accountType =
      input.accountType ?? (await getSocialFlowAccountTypeByTenant(input.tenantId).catch(() => null)) ?? "influencer";
    if (accountType !== "empresa") return null;

    const [growth, seasonal, sentiment] = await Promise.all([
      getLatestAudienceGrowth(input.tenantId, input.saasId, dracoEnv).catch(() => null),
      getLatestSeasonalOpportunities(input.tenantId, input.saasId, dracoEnv).catch(() => null),
      getLatestSentimentTrend(input.tenantId, input.saasId, dracoEnv).catch(() => null),
    ]);

    const audienceActive = Boolean(growth && (growth.growthPosts.length > 0 || growth.loyaltyPosts.length > 0));

    const nearTermEvent = seasonal?.upcomingOpportunities.find((o) => o.daysUntil <= NEAR_TERM_DAYS) ?? null;
    const seasonalEvent = nearTermEvent?.event ?? null;

    // Sin snapshot de sentimiento no hay garantía de que esté sano — no se arriesga.
    const sentimentOk = Boolean(sentiment && !sentiment.alert && sentiment.trend !== "declining");

    const favorableCount = [audienceActive, Boolean(seasonalEvent), sentimentOk].filter(Boolean).length;
    const opportunityScore = Math.round((favorableCount / 3) * 100);

    let recommendation: string;
    let feedPriority: IntelligenceFeedPriority | null = null;
    let feedTitle = "";

    if (!sentimentOk) {
      recommendation = "No es buen momento para promocionar: el sentimiento de tus comentarios está en alerta. Resuélvelo antes de lanzar ofertas.";
    } else if (audienceActive && seasonalEvent) {
      recommendation = `🎯 Momento ideal para lanzar una promoción — tu audiencia está activa y se acerca ${seasonalEvent}.`;
      feedPriority = "high";
      feedTitle = "Momento ideal para lanzar una promoción";
    } else if (audienceActive) {
      recommendation = "Buen momento para una promoción: audiencia activa y sentimiento positivo, aunque no hay una fecha estacional próxima.";
      feedPriority = "medium";
      feedTitle = "Buen momento para lanzar una promoción";
    } else if (seasonalEvent) {
      recommendation = `Se acerca ${seasonalEvent} y el sentimiento es positivo, pero la audiencia no muestra alto engagement reciente — considera reforzar contenido antes de promocionar.`;
      feedPriority = "medium";
      feedTitle = "Buen momento para lanzar una promoción";
    } else {
      recommendation = "Aún no hay señales suficientes para recomendar un lanzamiento de promoción.";
    }

    const result: RevenueOpportunityResult = {
      opportunityScore,
      signals: { audienceActive, seasonalEvent, sentimentOk },
      recommendation,
    };

    if (feedPriority) {
      await seedFeedItems(
        input.tenantId,
        [{ type: "opportunity" as const, priority: feedPriority, title: feedTitle, description: recommendation, source: SOURCE }],
        input.saasId,
      );
    } else {
      await dismissFeedItemsBySource(input.tenantId, SOURCE, input.saasId).catch(() => {});
    }

    await upsertRevenueOpportunity(input.tenantId, input.saasId, JSON.stringify(result), dracoEnv);
    return result;
  }
}

// --- Persistencia (tabla propia por tenant, ver migración 0238) -------------------

async function upsertRevenueOpportunity(tenantId: string, saasId: string, snapshot: string, dracoEnv: DracoEnv): Promise<void> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return;

  try {
    const now = new Date().toISOString();
    const existing = await db
      .prepare(`SELECT id FROM socialcors_revenue_opportunities WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE socialcors_revenue_opportunities SET snapshot_json = ?, updated_at = ? WHERE id = ?`)
        .bind(snapshot, now, existing.id)
        .run();
      return;
    }

    await db
      .prepare(
        `INSERT INTO socialcors_revenue_opportunities (id, tenant_id, saas_id, snapshot_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), tenantId, saasId, snapshot, now, now)
      .run();
  } catch (err) {
    console.error("[RevenueOpportunityAgent] upsertRevenueOpportunity failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
  }
}

// Lectura barata para el chat — nunca vuelve a leer los snapshots de los otros agentes,
// solo el snapshot que ya calculó el cron diario.
export async function getLatestRevenueOpportunity(
  tenantId: string,
  saasId: string,
  dracoEnv: DracoEnv,
): Promise<RevenueOpportunityResult | null> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return null;

  try {
    const row = await db
      .prepare(`SELECT snapshot_json FROM socialcors_revenue_opportunities WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ snapshot_json: string }>();

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as RevenueOpportunityResult;
  } catch (err) {
    console.error("[RevenueOpportunityAgent] getLatestRevenueOpportunity failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return null;
  }
}
