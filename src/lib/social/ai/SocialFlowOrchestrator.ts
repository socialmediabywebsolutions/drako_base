import { MarketResearchAgent } from "./agents/MarketResearchAgent";
import { KeywordAgent } from "./agents/KeywordAgent";
import { CompetitorAgent } from "./agents/CompetitorAgent";
import { StrategyAgent } from "./agents/StrategyAgent";
import { ContentGeneratorAgent } from "./agents/ContentGeneratorAgent";
import { OptimizationAgent } from "./agents/OptimizationAgent";
import { SchedulerAgent } from "./agents/SchedulerAgent";
import { TrendAgent } from "./agents/TrendAgent";
import type {
  BrandProfile,
  SocialAIPipelineInput,
  SocialAIPipelineResult,
  StrategyItem,
  KeywordEngineOutput,
} from "./types";
import {
  upsertDemoSaasSocialCampaign,
  upsertDemoSaasSocialPost,
} from "../../admin/demo-data";
import { getChannelProfile } from "../profile/repository";
import { saveCompetitorInsights } from "../profile/repository";

export class SocialFlowOrchestrator {
  private marketResearch = new MarketResearchAgent();
  private keywordAgent = new KeywordAgent();
  private competitorAgent = new CompetitorAgent();
  private strategyAgent = new StrategyAgent();
  private contentGenerator = new ContentGeneratorAgent();
  private optimizationAgent = new OptimizationAgent();
  private schedulerAgent = new SchedulerAgent();
  private trendAgent = new TrendAgent();

  private buildProfile(input: SocialAIPipelineInput): BrandProfile {
    const channel = getChannelProfile(input.tenantId);
    return {
      // Core brand & channel identity
      brandIdentity: channel.brandName,
      channelHandle: channel.channelName,
      shortDescription: channel.shortDescription,
      longDescription: channel.longDescription,
      mission: channel.mission,
      valueProposition: channel.valueProposition,
      toneOfVoice: channel.toneOfVoice || input.tone,
      personality: channel.personality,

      // Audience & positioning
      niche: channel.niche || input.niche,
      audience: channel.audienceDescription,
      buyerPersona: channel.buyerPersona,
      painPoints: channel.painPoints,
      desires: channel.desires,
      objections: channel.objections,

      // Offer & differentiation
      services: channel.services,
      products: channel.products,
      offers: channel.offers,
      differentiators: channel.differentiators,
      primaryCTA: channel.primaryCTA,
      secondaryCTAs: channel.secondaryCTAs,

      // Content & SEO
      baseKeywords: channel.baseKeywords.length ? channel.baseKeywords : [input.niche],
      priorityKeywords: channel.priorityKeywords,
      longTailKeywords: channel.longTailKeywords,
      baseHashtags: channel.baseHashtags.length ? channel.baseHashtags : ["#socialflow"],
      priorityHashtags: channel.priorityHashtags,
      competitorHashtags: channel.competitorHashtags,
      contentPillars: channel.contentPillars,
      preferredFormats: channel.preferredFormats,
      avoidedFormats: channel.avoidedFormats,

      // Topics & trends
      viralThemes: channel.viralThemes,
      trendingTopics: channel.trendingTopics,
      seasonalTopics: channel.seasonalTopics,

      // Market & signals
      marketSignals: channel.marketSignals,
      opportunitySignals: channel.opportunitySignals,
      demandSignals: channel.demandSignals,

      // Restrictions & safety
      forbiddenTopics: channel.forbiddenTopics,
      prohibitedClaims: channel.prohibitedClaims,
      bannedWords: channel.bannedWords,
      forbiddenAngles: channel.forbiddenAngles,
    };
  }

  async generateFullCampaign(input: SocialAIPipelineInput): Promise<SocialAIPipelineResult> {
    const profile = this.buildProfile(input);

    // 1) Competitor intelligence
    const competitors = await this.competitorAgent.run({ niche: profile.niche });
    // 2) Persist competitor intelligence into the channel knowledge base (demo mode aware)
    saveCompetitorInsights(input.tenantId, competitors);

    // 3) Trend analysis
    const trends = await this.trendAgent.run({ profile });

    // 4) Keyword engine (uses profile + trends)
    const { research, engine: keywordEngine } = await this.keywordAgent.run({ profile, trends });

    const horizonDays = Math.max(7, Math.min(30, Math.round((input.frequencyPerWeek / 7) * 30) || 7));
    const strategy = await this.strategyAgent.run({
      profileNiche: input.niche,
      tone: input.tone,
      horizonDays,
    });

    const generatedPosts = [];
    const optimizedPosts = [];
    for (const item of strategy.items) {
      const generated = await this.contentGenerator.run({ profile, strategyItem: item, keywordEngine, trends });
      generatedPosts.push(generated);
      const bestVariant = generated.variants[0];
      const optimized = await this.optimizationAgent.run({ profile, variant: bestVariant, keywordEngine });
      optimizedPosts.push(optimized);
    }

    const schedule = this.schedulerAgent.run({
      strategy: strategy.items as StrategyItem[],
      frequencyPerWeek: input.frequencyPerWeek,
    });

    await this.persistToDemo(input, strategy.items, optimizedPosts, schedule);

    return {
      profile,
      research,
      keywords: research,
      competitors,
      strategy,
      generatedPosts,
      optimizedPosts,
      schedule,
    };
  }

  async generateStrategyOnly(input: SocialAIPipelineInput) {
    const profile = this.buildProfile(input);
    const competitors = await this.competitorAgent.run({ niche: profile.niche });
    saveCompetitorInsights(input.tenantId, competitors);
    const trends = await this.trendAgent.run({ profile });
    const { research, engine: keywordEngine } = await this.keywordAgent.run({ profile, trends });

    const strategy = await this.strategyAgent.run({
      profileNiche: input.niche,
      tone: input.tone,
      horizonDays: 7,
    });

    return { profile, research, keywords: research, competitors, strategy };
  }

  async generateSinglePost(input: SocialAIPipelineInput) {
    const profile = this.buildProfile(input);
    const trends = await this.trendAgent.run({ profile });
    const { engine: keywordEngine } = await this.keywordAgent.run({ profile, trends });
    const strategy = await this.strategyAgent.run({
      profileNiche: input.niche,
      tone: input.tone,
      horizonDays: 1,
    });

    const item = strategy.items[0];
    const generated = await this.contentGenerator.run({ profile, strategyItem: item, keywordEngine, trends });
    const bestVariant = generated.variants[0];
    const optimized = await this.optimizationAgent.run({ profile, variant: bestVariant, keywordEngine });

    return { profile, strategyItem: item, generated, optimized };
  }

  private async persistToDemo(
    input: SocialAIPipelineInput,
    strategyItems: StrategyItem[],
    optimizedPosts: { id: string; improvedText: string }[],
    schedule: { id: string; postId: string; scheduledAt: string }[],
  ) {
    const tenantId = input.tenantId;
    const saasId = input.saasId;

    const campaign = upsertDemoSaasSocialCampaign(tenantId, {
      id: `ai_campaign_${Date.now()}`,
      saas_id: saasId,
      name: `AI Campaign: ${input.niche}`,
      objective: "AWARENESS",
      status: "ACTIVE",
      target_segment: "DEFAULT",
      start_date: null,
      end_date: null,
      budget_estimate: null,
      notes: "Generated by SocialFlow AI demo pipeline",
    });

    const campaignId = campaign.id;

    for (const item of strategyItems) {
      const sched = schedule.find((s) => s.postId === item.id);
      const optimized = optimizedPosts.find((p) => p.id === `gen_${item.id}` || p.id === item.id);

      const content = optimized?.improvedText ?? item.angle;

      upsertDemoSaasSocialPost(tenantId, {
        id: `ai_post_${campaignId}_${item.id}`,
        saas_id: saasId,
        campaign_id: campaignId,
        provider: "LINKEDIN",
        content_type: "FEED",
        title: item.theme,
        body: content,
        image_hint: null,
        status: sched?.scheduledAt ? "SCHEDULED" : "DRAFT",
        scheduled_at: sched?.scheduledAt ?? null,
        posted_at: null,
        external_post_id: null,
        metadata: null,
      });
    }
  }
}
