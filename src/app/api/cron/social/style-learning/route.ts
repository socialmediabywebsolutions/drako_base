export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { env } from "@/lib/cf";
import { StyleLearningAgent } from "@/lib/socialflow/ai/agents/StyleLearningAgent";
import { VoiceExtractionAgent } from "@/lib/socialflow/ai/agents/VoiceExtractionAgent";
import { ContentFatigueAgent } from "@/lib/socialflow/ai/agents/ContentFatigueAgent";
import { ContentPerformanceAgent } from "@/lib/socialflow/ai/agents/ContentPerformanceAgent";
import { HashtagIntelligenceAgent } from "@/lib/socialflow/ai/agents/HashtagIntelligenceAgent";
import { AudienceGrowthAgent } from "@/lib/socialflow/ai/agents/AudienceGrowthAgent";
import { OptimalPostingScheduleAgent } from "@/lib/socialflow/ai/agents/OptimalPostingScheduleAgent";
import { SentimentTrendAgent } from "@/lib/socialflow/ai/agents/SentimentTrendAgent";
import { ContentSeriesAgent } from "@/lib/socialflow/ai/agents/ContentSeriesAgent";
import { BrandConsistencyAgent } from "@/lib/socialflow/ai/agents/BrandConsistencyAgent";
import { ContentDiversityAgent } from "@/lib/socialflow/ai/agents/ContentDiversityAgent";
import { RevenueOpportunityAgent } from "@/lib/socialflow/ai/agents/RevenueOpportunityAgent";
import { withAgentExecutionLog } from "@/lib/socialflow/intelligence/agent-execution-log";

const MIN_PUBLISHED_POSTS = 10;

type TenantRow = { tenant_id: string; saas_id: string; published_count: number };

type TenantResult = {
  tenantId: string;
  saasId: string;
  ok: boolean;
  postsAnalyzed?: number;
  voicePostsAnalyzed?: number;
  hookFatigued?: boolean;
  formatFatigued?: boolean;
  performanceAnalyzed?: number;
  hashtagsOverused?: number;
  growthPostsFound?: number;
  loyaltyPostsFound?: number;
  bestDaysFound?: number;
  sentimentAlert?: boolean;
  seriesOpportunitiesFound?: number;
  brandConsistencyAlert?: boolean;
  diversityScore?: number;
  revenueOpportunityScore?: number;
  error?: string;
};

export async function GET(request: NextRequest) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    if (error instanceof CronAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bindings = env();
  const socialDb = bindings?.SOCIAL_DB;
  if (!socialDb) {
    return NextResponse.json({ ok: false, code: "SOCIAL_DB_UNAVAILABLE" }, { status: 503 });
  }

  // Every tenant/saas pair with at least MIN_PUBLISHED_POSTS published posts.
  let tenantRows: TenantRow[];
  try {
    const result = await socialDb
      .prepare(
        `SELECT tenant_id, saas_id, COUNT(*) as published_count
         FROM saas_social_posts
         WHERE status IN ('POSTED', 'PUBLISHED')
         GROUP BY tenant_id, saas_id
         HAVING COUNT(*) >= ?`,
      )
      .bind(MIN_PUBLISHED_POSTS)
      .all<TenantRow>();
    tenantRows = result.results ?? [];
  } catch (err) {
    console.error("[cron/style-learning] tenant query failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, code: "DB_QUERY_FAILED" }, { status: 500 });
  }

  if (!tenantRows.length) {
    return NextResponse.json({ ok: true, message: "No tenants with enough published posts yet", results: [] });
  }

  const results: TenantResult[] = [];

  for (const row of tenantRows) {
    try {
      // En paralelo — los once agentes son independientes (cada uno solo lee
      // saas_social_posts/saas_social_metrics/socialflow_conversation_threads por su
      // cuenta, ninguno depende del resultado de otro), así que correrlos a la vez
      // reduce el tiempo total del cron en vez de sumarlo. ContentPerformanceAgent/
      // HashtagIntelligenceAgent/AudienceGrowthAgent/OptimalPostingScheduleAgent/
      // SentimentTrendAgent/ContentSeriesAgent/BrandConsistencyAgent/
      // ContentDiversityAgent persisten cada uno en su propia tabla
      // (socialcors_performance_snapshots migración 0225, socialcors_hashtag_intelligence
      // migración 0227, socialcors_audience_growth migración 0228,
      // socialcors_posting_schedule migración 0229, socialcors_sentiment_trend migración
      // 0230, socialcors_content_series migración 0232, socialcors_brand_consistency
      // migración 0235, socialcors_content_diversity migración 0236) — nunca en
      // socialcors_style_history, que StyleLearningAgent y detectContentFatigue tratan
      // como snapshots homogéneos.
      const logScope = { tenantId: row.tenant_id, saasId: row.saas_id };
      const [learned, voice, fatigue, performance, hashtags, growth, postingSchedule, sentiment, series, brandConsistency, diversity] = await Promise.all([
        withAgentExecutionLog({
          db: socialDb, agentName: "StyleLearningAgent", ...logScope,
          run: () => new StyleLearningAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id }),
          rowsWritten: (r) => r?.postsAnalyzed ?? null,
        }),
        withAgentExecutionLog({
          db: socialDb, agentName: "VoiceExtractionAgent", ...logScope,
          run: () => new VoiceExtractionAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id }),
          rowsWritten: (r) => r?.postsAnalyzed ?? null,
        }),
        withAgentExecutionLog({
          db: socialDb, agentName: "ContentFatigueAgent", ...logScope,
          run: () => new ContentFatigueAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id }),
        }),
        withAgentExecutionLog({
          db: socialDb, agentName: "ContentPerformanceAgent", ...logScope,
          run: () => new ContentPerformanceAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id }),
          rowsWritten: (r) => r?.topPosts.length ?? null,
        }),
        withAgentExecutionLog({
          db: socialDb, agentName: "HashtagIntelligenceAgent", ...logScope,
          run: () => new HashtagIntelligenceAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id }),
          rowsWritten: (r) => r?.overusedHashtags.length ?? null,
        }),
        withAgentExecutionLog({
          db: socialDb, agentName: "AudienceGrowthAgent", ...logScope,
          run: () => new AudienceGrowthAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id }),
          rowsWritten: (r) => (r ? r.growthPosts.length + r.loyaltyPosts.length : null),
        }),
        withAgentExecutionLog({
          db: socialDb, agentName: "OptimalPostingScheduleAgent", ...logScope,
          run: () => new OptimalPostingScheduleAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id }),
          rowsWritten: (r) => r?.bestDays.length ?? null,
        }),
        withAgentExecutionLog({
          db: socialDb, agentName: "SentimentTrendAgent", ...logScope,
          run: () => new SentimentTrendAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id }),
        }),
        withAgentExecutionLog({
          db: socialDb, agentName: "ContentSeriesAgent", ...logScope,
          run: () => new ContentSeriesAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id }),
          rowsWritten: (r) => r?.totalOpportunities ?? null,
        }),
        withAgentExecutionLog({
          db: socialDb, agentName: "BrandConsistencyAgent", ...logScope,
          run: () => new BrandConsistencyAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id }),
        }),
        withAgentExecutionLog({
          db: socialDb, agentName: "ContentDiversityAgent", ...logScope,
          run: () => new ContentDiversityAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id }),
        }),
      ]);

      // RevenueOpportunityAgent corre DESPUÉS del Promise.all de arriba, no dentro —
      // depende de leer los snapshots ya persistidos por AudienceGrowthAgent y
      // SentimentTrendAgent de este mismo ciclo (getLatest*), así que necesita que
      // ambos hayan terminado de escribir antes de leer. Solo aplica a
      // accountType="empresa" — devuelve null en silencio para influencer.
      const revenueOpportunity = await withAgentExecutionLog({
        db: socialDb, agentName: "RevenueOpportunityAgent", ...logScope,
        run: () => new RevenueOpportunityAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id }),
      });

      results.push({
        tenantId: row.tenant_id,
        saasId: row.saas_id,
        ok: true,
        postsAnalyzed: learned?.postsAnalyzed ?? 0,
        voicePostsAnalyzed: voice?.postsAnalyzed ?? 0,
        hookFatigued: fatigue?.hookFatigued ?? false,
        formatFatigued: fatigue?.formatFatigued ?? false,
        performanceAnalyzed: performance?.topPosts.length ?? 0,
        hashtagsOverused: hashtags?.overusedHashtags.length ?? 0,
        growthPostsFound: growth?.growthPosts.length ?? 0,
        loyaltyPostsFound: growth?.loyaltyPosts.length ?? 0,
        bestDaysFound: postingSchedule?.bestDays.length ?? 0,
        sentimentAlert: sentiment?.alert ?? false,
        seriesOpportunitiesFound: series?.totalOpportunities ?? 0,
        brandConsistencyAlert: brandConsistency?.alert ?? false,
        diversityScore: diversity?.overallDiversityScore,
        revenueOpportunityScore: revenueOpportunity?.opportunityScore,
      });
    } catch (err) {
      console.error("[cron/style-learning] agent failed", row.tenant_id, err instanceof Error ? err.message : String(err));
      results.push({
        tenantId: row.tenant_id,
        saasId: row.saas_id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, tenantsProcessed: results.length, results });
}
