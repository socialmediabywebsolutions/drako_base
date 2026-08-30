import { resolveSocialContext, listSaasSocialPosts, listSaasSocialMetricsForPost } from "@/lib/socialflow/repository";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import { getSocialFlowAccountTypeByTenant } from "@/lib/socialflow/auth/account-type";
import { seedFeedItems, dismissFeedItemsBySource } from "@/lib/socialflow/intelligence/repository";
import { classifyHook } from "@/lib/socialflow/ai/agents/contentHeuristics";
import type { PostWithEngagement } from "@/lib/socialflow/ai/agents/EngagementLearningAgent";
import { getNicheIntelligence, type Env } from "./NicheIntelligenceService";
import { extractEngagementPatterns } from "./CrossTenantIntelligenceAgent";

const LOOKBACK_DAYS = 30;
const MAX_HOOK_TITLE_LENGTH = 60;

const HOOK_SOURCE = "viral_opportunity:hook";
const FORMAT_SOURCE = "viral_opportunity:format";

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

// Sin llamada a IA en este agente (100% determinista, ver processTenant) — la
// diferenciación por accountType se aplica directamente a los textos de las tarjetas
// del feed, no a un prompt.
const OPPORTUNITY_COPY = {
  influencer: {
    hookSuffix: "cuéntalo con tu propia historia y voz personal en tu próximo Reel o post — todavía no lo has probado en tus últimos",
    hookActionLabel: "Crear contenido con este hook",
    formatSuffix: "es una oportunidad real de viralidad que todavía no has probado en tus últimos",
    formatActionLabel: "Probar este formato",
  },
  empresa: {
    hookSuffix: "es una forma real de captar clientes y diferenciarte de tu competencia que tu negocio todavía no ha probado en los últimos",
    hookActionLabel: "Captar clientes con este hook",
    formatSuffix: "es una oportunidad real de reputación y captación local que todavía no has probado en los últimos",
    formatActionLabel: "Probar este formato para tu negocio",
  },
} as const satisfies Record<"influencer" | "empresa", { hookSuffix: string; hookActionLabel: string; formatSuffix: string; formatActionLabel: string }>;

export type ViralOpportunityResult = {
  tenantId: string;
  saasId: string;
  ok: boolean;
  hookOpportunity?: string | null;
  formatOpportunity?: string | null;
  error?: string;
};

async function processTenant(
  tenantId: string,
  saasId: string,
  env: Env,
): Promise<{ hookOpportunity: string | null; formatOpportunity: string | null }> {
  const profile = await getChannelProfile(tenantId, saasId);
  const accountType = (await getSocialFlowAccountTypeByTenant(tenantId).catch(() => null)) ?? "influencer";
  const nicheIntel = profile.niche ? await getNicheIntelligence(profile.niche, env, tenantId, saasId, accountType) : null;
  const engagementPatterns = extractEngagementPatterns(nicheIntel?.analysis);

  // Restricción explícita del diseño: sin engagementPatterns reales (nicho con <3
  // tenants, o niche-intelligence todavía no ha corrido esta semana), no se inventa
  // ninguna oportunidad — se limpia cualquier tarjeta de una semana anterior en la que
  // sí hubiera datos, para no dejar una afirmación que ya no está respaldada.
  if (!engagementPatterns) {
    await Promise.all([
      dismissFeedItemsBySource(tenantId, HOOK_SOURCE, saasId),
      dismissFeedItemsBySource(tenantId, FORMAT_SOURCE, saasId),
    ]);
    return { hookOpportunity: null, formatOpportunity: null };
  }

  const ctx = await resolveSocialContext({ tenantId, saasId, env });
  const allPosts = await listSaasSocialPosts(ctx);
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const recentPosts = allPosts.filter((post) => {
    if (post.status !== "POSTED" && post.status !== "PUBLISHED") return false;
    const stamp = post.postedAt ?? post.scheduledAt;
    return Boolean(stamp) && new Date(stamp as string).getTime() >= cutoff;
  });

  if (!recentPosts.length) {
    await Promise.all([
      dismissFeedItemsBySource(tenantId, HOOK_SOURCE, saasId),
      dismissFeedItemsBySource(tenantId, FORMAT_SOURCE, saasId),
    ]);
    return { hookOpportunity: null, formatOpportunity: null };
  }

  const usedHooks = new Set(recentPosts.map((post) => classifyHook(post.body.split("\n")[0] ?? "")));
  const usedFormats = new Set<string>(recentPosts.map((post) => post.contentType));

  const withEngagement: PostWithEngagement[] = await Promise.all(
    recentPosts.map(async (post) => {
      const metrics = await listSaasSocialMetricsForPost(ctx, post.id).catch(() => []);
      const latest = metrics[0] ?? null;
      return {
        post,
        engagement: latest ? latest.likes + latest.comments + latest.shares : 0,
        hasMetrics: Boolean(latest),
      };
    }),
  );
  const withRealMetrics = withEngagement.filter((w) => w.hasMetrics);
  const overallAvg = withRealMetrics.length
    ? withRealMetrics.reduce((sum, w) => sum + w.engagement, 0) / withRealMetrics.length
    : 0;

  // Ambas listas ya vienen ordenadas por avgEngagement desc y ya filtradas a
  // tenantsReporting >= 2 desde CrossTenantIntelligenceAgent — find() devuelve
  // directamente la mejor entrada no probada. avgEngagement > overallAvg no estaba en
  // el pedido original: sin esto, "oportunidad" solo significaría "no probado", incluso
  // si el nicho rinde peor que lo que ya le funciona a este cliente.
  const bestUntriedHook = engagementPatterns.hooksQueFuncionanRealmente.find(
    (h) => !usedHooks.has(h.hook) && h.avgEngagement > overallAvg,
  );
  const bestUntriedFormat = engagementPatterns.formatosGanadoresReales.find(
    (f) => !usedFormats.has(f.format) && f.avgEngagement > overallAvg,
  );

  const copy = OPPORTUNITY_COPY[accountType];

  if (bestUntriedHook) {
    await seedFeedItems(
      tenantId,
      [{
        type: "opportunity",
        priority: "medium",
        title: truncate(`Hook viral en ${profile.niche}: "${bestUntriedHook.hook}"`, MAX_HOOK_TITLE_LENGTH),
        description: `En tu nicho, los posts con hook tipo "${bestUntriedHook.hook}" tienen un engagement medio de ${bestUntriedHook.avgEngagement} (basado en ${bestUntriedHook.tenantsReporting} cuentas reales) — ${copy.hookSuffix} ${LOOKBACK_DAYS} días.`,
        actionLabel: copy.hookActionLabel,
        actionHref: "/socialflow/ai",
        source: HOOK_SOURCE,
      }],
      saasId,
    );
  } else {
    await dismissFeedItemsBySource(tenantId, HOOK_SOURCE, saasId);
  }

  if (bestUntriedFormat) {
    await seedFeedItems(
      tenantId,
      [{
        type: "opportunity",
        priority: "medium",
        title: `El formato ${bestUntriedFormat.format} está funcionando mejor en tu nicho`,
        description: `En tu nicho, los posts en formato ${bestUntriedFormat.format} tienen un engagement medio de ${bestUntriedFormat.avgEngagement} (basado en ${bestUntriedFormat.tenantsReporting} cuentas reales) — ${copy.formatSuffix} ${LOOKBACK_DAYS} días.`,
        actionLabel: copy.formatActionLabel,
        actionHref: "/socialflow/ai",
        source: FORMAT_SOURCE,
      }],
      saasId,
    );
  } else {
    await dismissFeedItemsBySource(tenantId, FORMAT_SOURCE, saasId);
  }

  return {
    hookOpportunity: bestUntriedHook?.hook ?? null,
    formatOpportunity: bestUntriedFormat?.format ?? null,
  };
}

// Runs weekly, after CrossTenantIntelligenceAgent — needs that week's freshly-merged
// analysis_json.engagementPatterns per niche. Never throws per tenant, same convention
// as NicheIntelligenceCronAgent/CrossTenantIntelligenceAgent.
export async function runViralOpportunityCron(env: Env): Promise<ViralOpportunityResult[]> {
  const db = env?.SOCIAL_DB;
  if (!db) return [];

  const { results: tenantRows } = await db
    .prepare(`SELECT DISTINCT tenant_id, saas_id FROM socialflow_profiles`)
    .all<{ tenant_id: string; saas_id: string }>();

  const results: ViralOpportunityResult[] = [];

  for (const row of tenantRows ?? []) {
    try {
      const outcome = await processTenant(row.tenant_id, row.saas_id, env);
      results.push({ tenantId: row.tenant_id, saasId: row.saas_id, ok: true, ...outcome });
    } catch (err) {
      console.error("[ViralOpportunityAgent] tenant failed", row.tenant_id, err instanceof Error ? err.message : String(err));
      results.push({ tenantId: row.tenant_id, saasId: row.saas_id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return results;
}
