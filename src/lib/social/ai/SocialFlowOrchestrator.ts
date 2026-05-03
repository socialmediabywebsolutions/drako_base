/**
 * @deprecated SocialFlow AI orchestration is being verticalized under socialflow/ai.
 * This file remains as legacy backing code during verticalization.
 */
import { MarketResearchAgent } from "./agents/MarketResearchAgent";
import { KeywordAgent } from "./agents/KeywordAgent";
import { CompetitorAgent } from "./agents/CompetitorAgent";
import { StrategyAgent } from "./agents/StrategyAgent";
import { ContentGeneratorAgent } from "./agents/ContentGeneratorAgent";
import { OptimizationAgent } from "./agents/OptimizationAgent";
import { SchedulerAgent } from "./agents/SchedulerAgent";
import { TrendAgent } from "./agents/TrendAgent";
import type { BrandProfile, SocialAIPipelineInput, SocialAIPipelineResult, StrategyItem } from "./types";
import { getSaasSocialChannelKnowledge, getSaasSocialChannelSignals, listSaasSocialChannels, resolveSocialContext, upsertSaasSocialCampaign, upsertSaasSocialChannelKnowledge, upsertSaasSocialChannelSignals, upsertSaasSocialPost } from "../repository";

export class SocialFlowOrchestrator {
  private marketResearch = new MarketResearchAgent();
  private keywordAgent = new KeywordAgent();
  private competitorAgent = new CompetitorAgent();
  private strategyAgent = new StrategyAgent();
  private contentGenerator = new ContentGeneratorAgent();
  private optimizationAgent = new OptimizationAgent();
  private schedulerAgent = new SchedulerAgent();
  private trendAgent = new TrendAgent();

  private async buildProfile(input: SocialAIPipelineInput): Promise<BrandProfile> {
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const channels = await listSaasSocialChannels(ctx);
    const channel = channels[0];
    const knowledge = channel ? await getSaasSocialChannelKnowledge(ctx, channel.id) : null;
    const signals = channel ? await getSaasSocialChannelSignals(ctx, channel.id) : null;
    const brandIdentity = input.saasId.replace(/[-_]/g, " ");
    return {
      brandIdentity,
      channelHandle: `@${input.saasId}`,
      shortDescription: knowledge?.objective ?? `${input.niche} social automation`,
      longDescription: knowledge?.audience ?? `${input.niche} content pipeline stored in SOCIAL_DB.`,
      mission: knowledge?.objective ?? `Grow ${input.saasId} with consistent social execution.`,
      valueProposition: knowledge?.objective ?? `Operational social content for ${input.niche}.`,
      toneOfVoice: knowledge?.tone ?? input.tone,
      personality: input.tone,
      niche: knowledge?.objective ?? input.niche,
      audience: knowledge?.audience ?? `${input.niche} buyers`,
      buyerPersona: knowledge?.audience ?? `${input.niche} operator`,
      painPoints: signals?.topics.length ? signals.topics : [input.niche],
      desires: signals?.activeKeywords.length ? signals.activeKeywords : ["growth"],
      objections: signals?.watchedCompetitors.length ? signals.watchedCompetitors : ["time"],
      services: [],
      products: [],
      offers: [],
      differentiators: signals?.watchedSources.length ? signals.watchedSources : ["SOCIAL_DB persistence"],
      primaryCTA: "Book now",
      secondaryCTAs: [],
      baseKeywords: knowledge?.keywords.length ? knowledge.keywords : [input.niche],
      priorityKeywords: knowledge?.keywords.length ? knowledge.keywords : [input.niche],
      longTailKeywords: knowledge?.keywords.map((keyword) => `${keyword} ${input.saasId}`) ?? [`${input.niche} ${input.saasId}`],
      baseHashtags: ["#socialflow", `#${input.saasId.replace(/[^a-z0-9]/gi, "")}`],
      priorityHashtags: knowledge?.keywords.map((keyword) => `#${keyword.replace(/\s+/g, "")}`) ?? ["#growth"],
      competitorHashtags: knowledge?.competitors.map((item) => `#${item.replace(/\s+/g, "")}`) ?? [],
      contentPillars: signals?.topics.length ? signals.topics : [input.niche],
      preferredFormats: ["carousel", "single"],
      avoidedFormats: [],
      viralThemes: signals?.topics ?? [],
      trendingTopics: signals?.activeKeywords ?? [],
      seasonalTopics: [],
      marketSignals: signals?.topics ?? [],
      opportunitySignals: signals?.activeKeywords ?? [],
      demandSignals: knowledge?.keywords ?? [input.niche],
      forbiddenTopics: [],
      prohibitedClaims: [],
      bannedWords: [],
      forbiddenAngles: [],
    };
  }

  async generateFullCampaign(input: SocialAIPipelineInput): Promise<SocialAIPipelineResult> {
    const profile = await this.buildProfile(input);
    const competitors = await this.competitorAgent.run({ niche: profile.niche });
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const channels = await listSaasSocialChannels(ctx);
    const channel = channels[0];
    if (channel) {
      const knowledge = await getSaasSocialChannelKnowledge(ctx, channel.id);
      await upsertSaasSocialChannelKnowledge(ctx, { channelId: channel.id, objective: knowledge?.objective ?? input.niche, audience: knowledge?.audience ?? input.niche, tone: knowledge?.tone ?? input.tone, keywords: Array.from(new Set([...(knowledge?.keywords ?? []), input.niche])), competitors: Array.from(new Set([...(knowledge?.competitors ?? []), ...competitors.map((item) => item.name)])), sources: knowledge?.sources ?? [], updatedAt: new Date().toISOString() });
      const signals = await getSaasSocialChannelSignals(ctx, channel.id);
      await upsertSaasSocialChannelSignals(ctx, { channelId: channel.id, topics: Array.from(new Set([...(signals.topics ?? []), ...competitors.flatMap((item) => item.contentPatterns.slice(0, 2))])), activeKeywords: Array.from(new Set([...(signals.activeKeywords ?? []), input.niche])), trendNotes: signals.trendNotes ?? null, watchedCompetitors: Array.from(new Set([...(signals.watchedCompetitors ?? []), ...competitors.map((item) => item.name)])), watchedSources: Array.from(new Set([...(signals.watchedSources ?? []), ...competitors.map((item) => item.platform)])), updatedAt: new Date().toISOString() });
    }
    const trends = await this.trendAgent.run({ profile });
    const { research, engine: keywordEngine } = await this.keywordAgent.run({ profile, trends });
    const horizonDays = Math.max(7, Math.min(30, Math.round((input.frequencyPerWeek / 7) * 30) || 7));
    const strategy = await this.strategyAgent.run({ profileNiche: input.niche, tone: input.tone, horizonDays });
    const generatedPosts = [];
    const optimizedPosts = [];
    for (const item of strategy.items) {
      const generated = await this.contentGenerator.run({ profile, strategyItem: item, keywordEngine, trends });
      generatedPosts.push(generated);
      const optimized = await this.optimizationAgent.run({ profile, variant: generated.variants[0], keywordEngine });
      optimizedPosts.push(optimized);
    }
    const schedule = this.schedulerAgent.run({ strategy: strategy.items as StrategyItem[], frequencyPerWeek: input.frequencyPerWeek });
    const campaignId = await this.persistToDb(input, strategy.items, optimizedPosts, schedule);
    return { profile, research, keywords: research, competitors, strategy, generatedPosts, optimizedPosts, schedule, campaignId };
  }

  async generateStrategyOnly(input: SocialAIPipelineInput) { const profile = await this.buildProfile(input); const competitors = await this.competitorAgent.run({ niche: profile.niche }); const trends = await this.trendAgent.run({ profile }); const { research } = await this.keywordAgent.run({ profile, trends }); const strategy = await this.strategyAgent.run({ profileNiche: input.niche, tone: input.tone, horizonDays: 7 }); return { profile, research, keywords: research, competitors, strategy }; }
  async generateSinglePost(input: SocialAIPipelineInput) { const profile = await this.buildProfile(input); const trends = await this.trendAgent.run({ profile }); const { engine: keywordEngine } = await this.keywordAgent.run({ profile, trends }); const strategy = await this.strategyAgent.run({ profileNiche: input.niche, tone: input.tone, horizonDays: 1 }); const item = strategy.items[0]; const generated = await this.contentGenerator.run({ profile, strategyItem: item, keywordEngine, trends }); const optimized = await this.optimizationAgent.run({ profile, variant: generated.variants[0], keywordEngine }); return { profile, strategyItem: item, generated, optimized }; }

  private async persistToDb(input: SocialAIPipelineInput, strategyItems: StrategyItem[], optimizedPosts: { id: string; improvedText: string }[], schedule: { id: string; postId: string; scheduledAt: string }[]): Promise<string> {
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const campaign = await upsertSaasSocialCampaign(ctx, { id: `ai_campaign_${Date.now()}`, saasId: input.saasId, name: `AI Campaign: ${input.niche}`, objective: "AWARENESS", status: "ACTIVE", targetSegment: "DEFAULT", startDate: null, endDate: null, budgetEstimate: null, notes: `Generated for ${input.niche}` });
    const channels = await listSaasSocialChannels(ctx);
    const channelId = channels[0]?.id ?? null;
    for (const item of strategyItems) {
      const sched = schedule.find((entry) => entry.postId === item.id);
      const optimized = optimizedPosts.find((entry) => entry.id === `gen_${item.id}` || entry.id === item.id);
      await upsertSaasSocialPost(ctx, { id: `ai_post_${campaign.id}_${item.id}`, saasId: input.saasId, channelId, campaignId: campaign.id, provider: "LINKEDIN", contentType: "FEED", title: item.theme, body: optimized?.improvedText ?? item.angle, imageHint: null, status: sched?.scheduledAt ? "SCHEDULED" : "DRAFT", scheduledAt: sched?.scheduledAt ?? null, postedAt: null, externalPostId: null, metadata: { strategyItemId: item.id, scheduledAt: sched?.scheduledAt ?? null } });
    }
    return campaign.id;
  }
}
