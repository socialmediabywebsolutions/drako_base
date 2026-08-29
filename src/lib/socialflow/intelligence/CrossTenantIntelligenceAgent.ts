import { resolveSocialContext, listSaasSocialPosts, listSaasSocialMetricsForPost } from "@/lib/socialflow/repository";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import { getSocialFlowAccountTypeByTenant } from "@/lib/socialflow/auth/account-type";
import { resolveNicheSlug, safeParseObject, type Env } from "./NicheIntelligenceService";
import {
  computeEngagementPatterns,
  type EngagementPatterns,
  type PostWithEngagement,
} from "@/lib/socialflow/ai/agents/EngagementLearningAgent";

type NicheAccountType = "influencer" | "empresa";
type NicheGroupKey = { niche: string; accountType: NicheAccountType };

const LOOKBACK_DAYS = 30;

// Below this many tenants, an "anonymized" niche aggregate is in practice just that
// tenant's own data with extra steps — see migration 0207's "never store
// tenant-identifying data here" comment. Applied twice: once to the whole niche group
// (skip the niche entirely below this), once per individual stat key below (a hook
// only one tenant in the group used is still identifiable within the group).
const MIN_TENANTS_FOR_NICHE = 3;
const MIN_TENANTS_PER_STAT = 2;

export type NicheEngagementPatterns = {
  hooksQueFuncionanRealmente: Array<{ hook: string; avgEngagement: number; tenantsReporting: number }>;
  formatosGanadoresReales: Array<{ format: string; avgEngagement: number; tenantsReporting: number }>;
  horasOptimasReales: Array<{ hourUtc: number; avgEngagement: number; tenantsReporting: number }>;
  hashtagsQueFuncionanRealmente: Array<{ hashtag: string; avgEngagement: number; tenantsReporting: number }>;
  sampleSize: number;
  computedAt: string;
};

// Shared validator for analysis_json.engagementPatterns — used by every reader of this
// shape (ViralOpportunityAgent, NicheIntelligenceCronAgent's real-hashtags-with-fallback,
// ContentGeneratorAgent/CarouselComposerAgent's prompt injection) so the same loose
// runtime check (never trust a JSON blob's shape blindly) isn't duplicated per caller.
export function extractEngagementPatterns(analysis: Record<string, unknown> | null | undefined): NicheEngagementPatterns | null {
  const raw = analysis?.engagementPatterns;
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<NicheEngagementPatterns>;
  if (!Array.isArray(candidate.hooksQueFuncionanRealmente) || !Array.isArray(candidate.formatosGanadoresReales)) return null;
  return candidate as NicheEngagementPatterns;
}

export type CrossTenantIntelligenceResult = {
  niche: string;
  accountType: NicheAccountType;
  ok: boolean;
  tenantsAggregated?: number;
  skippedReason?: string;
  error?: string;
};

type TenantRef = { tenantId: string; saasId: string };

async function computeTenantPatterns(tenant: TenantRef, env: Env): Promise<EngagementPatterns | null> {
  const ctx = await resolveSocialContext({ tenantId: tenant.tenantId, saasId: tenant.saasId, env });
  const posts = await listSaasSocialPosts(ctx);
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const recent = posts.filter((post) => {
    if (post.status !== "POSTED" && post.status !== "PUBLISHED") return false;
    const stamp = post.postedAt ?? post.scheduledAt;
    return Boolean(stamp) && new Date(stamp as string).getTime() >= cutoff;
  });
  if (!recent.length) return null;

  const withEngagement: PostWithEngagement[] = await Promise.all(
    recent.map(async (post) => {
      const metrics = await listSaasSocialMetricsForPost(ctx, post.id).catch(() => []);
      const latest = metrics[0] ?? null;
      return {
        post,
        engagement: latest ? latest.likes + latest.comments + latest.shares : 0,
        hasMetrics: Boolean(latest),
      };
    }),
  );

  const patterns = computeEngagementPatterns(withEngagement);
  return patterns.hookPerformance.length || patterns.formatPerformance.length ? patterns : null;
}

// Weighted-average merge across tenants for one stat dimension (hook, format, hour).
// Weight is each tenant's own `uses` count (posts backing that tenant's average), so a
// tenant with 20 posts in a bucket doesn't count the same as one with 1. tenantsReporting
// counts distinct tenants, not posts — that's the number that matters for anonymity.
function mergeStat(
  perTenantStats: Array<Array<{ key: string; avgEngagement: number; uses: number }>>,
): Array<{ key: string; avgEngagement: number; tenantsReporting: number }> {
  const agg = new Map<string, { totalWeighted: number; totalUses: number; tenantsReporting: number }>();
  for (const tenantStats of perTenantStats) {
    for (const stat of tenantStats) {
      const entry = agg.get(stat.key) ?? { totalWeighted: 0, totalUses: 0, tenantsReporting: 0 };
      entry.totalWeighted += stat.avgEngagement * stat.uses;
      entry.totalUses += stat.uses;
      entry.tenantsReporting += 1;
      agg.set(stat.key, entry);
    }
  }
  return Array.from(agg.entries())
    .map(([key, { totalWeighted, totalUses, tenantsReporting }]) => ({
      key,
      avgEngagement: totalUses > 0 ? Math.round((totalWeighted / totalUses) * 10) / 10 : 0,
      tenantsReporting,
    }))
    .filter((entry) => entry.tenantsReporting >= MIN_TENANTS_PER_STAT)
    .sort((a, b) => b.avgEngagement - a.avgEngagement);
}

// Same 20-hashtag ceiling as EngagementLearningAgent's per-tenant cap, applied again
// here because merging N tenants' top-20 lists can still produce more than 20 distinct
// keys — this is the cap that actually bounds analysis_json size.
const MAX_HASHTAGS = 20;

function aggregateNichePatterns(perTenantPatterns: EngagementPatterns[]): NicheEngagementPatterns {
  const hooks = mergeStat(perTenantPatterns.map((p) => p.hookPerformance.map((h) => ({ key: h.hook, avgEngagement: h.avgEngagement, uses: h.uses }))));
  const formats = mergeStat(perTenantPatterns.map((p) => p.formatPerformance.map((f) => ({ key: f.format, avgEngagement: f.avgEngagement, uses: f.uses }))));
  const hours = mergeStat(perTenantPatterns.map((p) => p.hourPerformance.map((h) => ({ key: String(h.hourUtc), avgEngagement: h.avgEngagement, uses: h.uses }))));
  const hashtags = mergeStat(perTenantPatterns.map((p) => p.hashtagsQueFuncionan.map((h) => ({ key: h.hashtag, avgEngagement: h.avgEngagement, uses: h.postsCount }))));

  return {
    hooksQueFuncionanRealmente: hooks.map(({ key, avgEngagement, tenantsReporting }) => ({ hook: key, avgEngagement, tenantsReporting })),
    formatosGanadoresReales: formats.map(({ key, avgEngagement, tenantsReporting }) => ({ format: key, avgEngagement, tenantsReporting })),
    horasOptimasReales: hours.map(({ key, avgEngagement, tenantsReporting }) => ({ hourUtc: Number(key), avgEngagement, tenantsReporting })),
    hashtagsQueFuncionanRealmente: hashtags
      .slice(0, MAX_HASHTAGS)
      .map(({ key, avgEngagement, tenantsReporting }) => ({ hashtag: key, avgEngagement, tenantsReporting })),
    sampleSize: perTenantPatterns.length,
    computedAt: new Date().toISOString(),
  };
}

// Merges into whatever NicheIntelligenceCronAgent already wrote for this niche this
// week (analysis_json = {"summary": "..."}), instead of overwriting the row — this
// agent must run AFTER the niche-intelligence cron step in the same weekly pass, or it
// will merge onto a stale row that gets clobbered a moment later by
// upsertNicheIntelligence's full-column REPLACE. Skips silently if no row exists yet
// for this niche (nothing to merge onto, and creating a bare row here would leave
// hashtags_json/formats_json/etc empty in a row getNicheIntelligence might still pick
// up as "valid").
async function mergeEngagementPatterns(db: D1Database, niche: string, accountType: NicheAccountType, patterns: NicheEngagementPatterns): Promise<void> {
  const row = await db
    .prepare(`SELECT id, analysis_json FROM socialcors_niche_intelligence WHERE niche = ? AND account_type = ? ORDER BY updated_at DESC LIMIT 1`)
    .bind(niche, accountType)
    .first<{ id: string; analysis_json: string }>();
  if (!row) return;

  const currentAnalysis = safeParseObject(row.analysis_json) ?? {};
  const nextAnalysis = { ...currentAnalysis, engagementPatterns: patterns };

  await db
    .prepare(`UPDATE socialcors_niche_intelligence SET analysis_json = ?, updated_at = ? WHERE id = ?`)
    .bind(JSON.stringify(nextAnalysis), new Date().toISOString(), row.id)
    .run();
}

// Groups every onboarded tenant by resolved niche slug. Iterates all of
// socialflow_profiles because normalizedNicheSlug lives inside metadata_json (no real
// column, no index) — same "list everyone, filter in memory" pattern already used by
// WeeklyBriefingAgent.runWeeklyBriefingForAllTenants. Acceptable at current tenant
// counts; would need a real indexed column if this ever needs to scale much further.
async function groupTenantsByNiche(db: D1Database, env: Env): Promise<Map<string, { key: NicheGroupKey; tenants: TenantRef[] }>> {
  const { results: tenantRows } = await db
    .prepare(`SELECT DISTINCT tenant_id, saas_id FROM socialflow_profiles`)
    .all<{ tenant_id: string; saas_id: string }>();

  const byNiche = new Map<string, { key: NicheGroupKey; tenants: TenantRef[] }>();
  for (const row of tenantRows ?? []) {
    try {
      const profile = await getChannelProfile(row.tenant_id, row.saas_id);
      if (!profile.niche) continue;
      const slug = await resolveNicheSlug(profile.niche, db, row.tenant_id, row.saas_id);
      if (!slug) continue;
      // Cerebro Socialcors — separado por accountType (ver migración 0224): un
      // influencer y una empresa del mismo nicho ya no se agregan en el mismo bucket.
      // Default "influencer" si el tenant no tiene account_type asignado, mismo
      // criterio que la migración y que getNicheIntelligence.
      const accountType = (await getSocialFlowAccountTypeByTenant(row.tenant_id).catch(() => null)) ?? "influencer";
      const mapKey = `${slug}::${accountType}`;
      const entry = byNiche.get(mapKey) ?? { key: { niche: slug, accountType }, tenants: [] };
      entry.tenants.push({ tenantId: row.tenant_id, saasId: row.saas_id });
      byNiche.set(mapKey, entry);
    } catch (err) {
      console.error("[CrossTenantIntelligenceAgent] niche resolution failed", row.tenant_id, err instanceof Error ? err.message : String(err));
    }
  }
  return byNiche;
}

// Runs weekly, after NicheIntelligenceCronAgent — aggregates each niche's real
// engagement data (hooks/formats/hours that actually performed, not an LLM's opinion)
// across every member tenant, anonymously, and merges it into
// socialcors_niche_intelligence.analysis_json.engagementPatterns. Never throws per
// niche — one bad niche shouldn't stop the rest of the run (same convention as
// NicheIntelligenceCronAgent.runNicheIntelligenceCron).
export async function runCrossTenantIntelligenceCron(env: Env): Promise<CrossTenantIntelligenceResult[]> {
  const db = env?.SOCIAL_DB;
  if (!db) return [];

  const byNiche = await groupTenantsByNiche(db, env);
  const results: CrossTenantIntelligenceResult[] = [];

  for (const { key, tenants } of byNiche.values()) {
    const { niche, accountType } = key;
    if (tenants.length < MIN_TENANTS_FOR_NICHE) {
      results.push({
        niche,
        accountType,
        ok: true,
        skippedReason: `only ${tenants.length} tenant(s) in this niche, minimum ${MIN_TENANTS_FOR_NICHE} for anonymized aggregation`,
      });
      continue;
    }

    try {
      const perTenantPatterns: EngagementPatterns[] = [];
      for (const tenant of tenants) {
        const patterns = await computeTenantPatterns(tenant, env);
        if (patterns) perTenantPatterns.push(patterns);
      }

      if (perTenantPatterns.length < MIN_TENANTS_FOR_NICHE) {
        results.push({
          niche,
          accountType,
          ok: true,
          skippedReason: `only ${perTenantPatterns.length} tenant(s) with real metrics in the last ${LOOKBACK_DAYS} days`,
        });
        continue;
      }

      const aggregated = aggregateNichePatterns(perTenantPatterns);
      await mergeEngagementPatterns(db, niche, accountType, aggregated);
      results.push({ niche, accountType, ok: true, tenantsAggregated: perTenantPatterns.length });
    } catch (err) {
      console.error("[CrossTenantIntelligenceAgent] niche failed", niche, accountType, err instanceof Error ? err.message : String(err));
      results.push({ niche, accountType, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return results;
}
