import { MarketResearchAgent } from "./agents/MarketResearchAgent";
import { KeywordAgent } from "./agents/KeywordAgent";
import { CompetitorAgent } from "./agents/CompetitorAgent";
import { StrategyAgent } from "./agents/StrategyAgent";
import { ContentGeneratorAgent } from "./agents/ContentGeneratorAgent";
import { OptimizationAgent } from "./agents/OptimizationAgent";
import { SchedulerAgent } from "./agents/SchedulerAgent";
import { TrendAgent } from "./agents/TrendAgent";
import type { BrandProfile, SocialAIPipelineInput, SocialAIPipelineResult, StrategyItem } from "./types";
import type { SaasSocialContentType } from "@/lib/social-core/types";
import { listSaasSocialChannels, resolveSocialContext, upsertSaasSocialCampaign, upsertSaasSocialPost } from "../repository";
import { getChannelKnowledge, saveCompetitorInsights } from "../profile/repository";
import { getKnowledgeContext } from "../knowledge/repository";
import { generatePostImage } from "./image-generator";
import { buildImagePrompt } from "./image-prompt-builder";

export class SocialFlowOrchestrator {
  private marketResearch = new MarketResearchAgent();
  private keywordAgent = new KeywordAgent();
  private competitorAgent = new CompetitorAgent();
  private strategyAgent = new StrategyAgent();
  private contentGenerator = new ContentGeneratorAgent();
  private optimizationAgent = new OptimizationAgent();
  private schedulerAgent = new SchedulerAgent();
  private trendAgent = new TrendAgent();

  async buildProfile(input: SocialAIPipelineInput): Promise<BrandProfile> {
    const [{ profile, competitors }, knowledgeContext] = await Promise.all([
      getChannelKnowledge(input.tenantId, input.saasId),
      getKnowledgeContext(input.tenantId, input.saasId).catch(() => ""),
    ]);

    const niche = input.niche || profile.niche || input.saasId;
    const tone = profile.toneOfVoice || input.tone || "neutro y profesional";
    const brandName = profile.brandName || input.saasId.replace(/[-_]/g, " ");

    const baseLongDescription = profile.longDescription || profile.shortDescription || `${niche} content pipeline`;
    const longDescription = knowledgeContext
      ? `${baseLongDescription}\n\n--- Knowledge Base ---\n${knowledgeContext}`
      : baseLongDescription;

    return {
      brandIdentity: brandName,
      channelHandle: profile.channelName ? `@${profile.channelName}` : `@${input.saasId}`,
      shortDescription: profile.shortDescription || `${niche} social automation`,
      longDescription,
      mission: profile.mission || `Grow ${brandName} with consistent social execution.`,
      valueProposition: profile.valueProposition || `${niche} content for ${profile.audienceDescription || "your audience"}.`,
      toneOfVoice: tone,
      personality: profile.personality || tone,
      niche,
      audience: profile.audienceDescription || `${niche} buyers`,
      buyerPersona: profile.buyerPersona || `${niche} operator`,
      painPoints: profile.painPoints.length ? profile.painPoints : [niche],
      desires: profile.desires.length ? profile.desires : ["growth"],
      objections: profile.objections.length ? profile.objections : ["time"],
      services: profile.services,
      products: profile.products,
      offers: profile.offers,
      differentiators: profile.differentiators,
      primaryCTA: profile.primaryCTA || "Reserva ahora",
      secondaryCTAs: profile.secondaryCTAs,
      baseKeywords: profile.baseKeywords.length ? profile.baseKeywords : [niche],
      priorityKeywords: profile.priorityKeywords.length ? profile.priorityKeywords : [niche],
      longTailKeywords: profile.longTailKeywords.length ? profile.longTailKeywords : [`${niche} ${brandName}`],
      baseHashtags: profile.baseHashtags.length ? profile.baseHashtags : [`#${brandName.replace(/\s+/g, "").toLowerCase()}`],
      priorityHashtags: profile.priorityHashtags.length ? profile.priorityHashtags : profile.baseKeywords.map((k) => `#${k.replace(/\s+/g, "")}`),
      competitorHashtags: profile.competitorHashtags.length ? profile.competitorHashtags : competitors.map((c) => `#${c.name.replace(/\s+/g, "")}`),
      contentPillars: profile.contentPillars.length ? profile.contentPillars : [niche],
      preferredFormats: profile.preferredFormats.length ? profile.preferredFormats : ["carousel", "single"],
      avoidedFormats: profile.avoidedFormats,
      viralThemes: profile.viralThemes,
      trendingTopics: profile.trendingTopics,
      seasonalTopics: profile.seasonalTopics,
      marketSignals: profile.marketSignals,
      opportunitySignals: profile.opportunitySignals,
      demandSignals: profile.demandSignals.length ? profile.demandSignals : [niche],
      forbiddenTopics: profile.forbiddenTopics,
      prohibitedClaims: profile.prohibitedClaims,
      bannedWords: profile.bannedWords,
      forbiddenAngles: profile.forbiddenAngles,
    };
  }

  async generateFullCampaign(input: SocialAIPipelineInput): Promise<SocialAIPipelineResult> {
    const profile = await this.buildProfile(input);
    const competitors = await this.competitorAgent.run({ niche: profile.niche });
    // Persist AI-discovered competitor insights back into socialflow_profiles
    await saveCompetitorInsights(input.tenantId, competitors, input.saasId).catch(() => {});
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const channels = await listSaasSocialChannels(ctx);
    const trends = await this.trendAgent.run({ profile });
    const { research, engine: keywordEngine } = await this.keywordAgent.run({ profile, trends });
    const numPosts = Math.max(1, Math.min(28, input.frequencyPerWeek));
    const strategy = await this.strategyAgent.run({ profile, horizonDays: numPosts });
    const generatedPosts = [];
    const optimizedPosts = [];
    for (const item of strategy.items) {
      const generated = await this.contentGenerator.run({ profile, strategyItem: item, keywordEngine, trends });
      generatedPosts.push(generated);
      const optimized = await this.optimizationAgent.run({ profile, variant: generated.variants[0], keywordEngine });
      optimizedPosts.push(optimized);
    }
    const schedule = this.schedulerAgent.run({
      strategy: strategy.items as StrategyItem[],
      frequencyPerWeek: input.frequencyPerWeek,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    });
    const campaignId = await this.persistToDb(input, profile, strategy.items as StrategyItem[], optimizedPosts, schedule);
    return { profile, research, keywords: research, competitors, strategy, generatedPosts, optimizedPosts, schedule, campaignId };
  }

  async generateStrategyOnly(input: SocialAIPipelineInput) { const profile = await this.buildProfile(input); const competitors = await this.competitorAgent.run({ niche: profile.niche }); const trends = await this.trendAgent.run({ profile }); const { research } = await this.keywordAgent.run({ profile, trends }); const strategy = await this.strategyAgent.run({ profile, horizonDays: 7 }); return { profile, research, keywords: research, competitors, strategy }; }
  async generateSinglePost(input: SocialAIPipelineInput) { const profile = await this.buildProfile(input); const trends = await this.trendAgent.run({ profile }); const { engine: keywordEngine } = await this.keywordAgent.run({ profile, trends }); const strategy = await this.strategyAgent.run({ profile, horizonDays: 1 }); const item = strategy.items[0]; const generated = await this.contentGenerator.run({ profile, strategyItem: item, keywordEngine, trends }); const optimized = await this.optimizationAgent.run({ profile, variant: generated.variants[0], keywordEngine }); return { profile, strategyItem: item, generated, optimized }; }

  private async persistToDb(input: SocialAIPipelineInput, profile: BrandProfile, strategyItems: StrategyItem[], optimizedPosts: { id: string; improvedText: string; hashtags?: string[] }[], schedule: { id: string; postId: string; scheduledAt: string }[]): Promise<string> {
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const campaign = await upsertSaasSocialCampaign(ctx, { id: input.campaignId ?? `ai_campaign_${Date.now()}`, saasId: input.saasId, name: `IA: ${input.niche}`, objective: "AWARENESS", status: "ACTIVE", targetSegment: "DEFAULT", startDate: input.startDate ?? null, endDate: input.endDate ?? null, budgetEstimate: null, notes: `Generated for ${input.niche}` });
    const channels = await listSaasSocialChannels(ctx);
    const postProvider = input.provider ?? "INSTAGRAM";
    const channelId = channels.find(c => c.provider === postProvider)?.id ?? null;
    let savedCount = 0;
    for (const item of strategyItems) {
      try {
        const sched = schedule.find((entry) => entry.postId === item.id);
        // OptimizationAgent stores id as variant.id ("gen_day_1_v1"); match by prefix to handle that.
        const optimized = optimizedPosts.find(
          (entry) => entry.id === `gen_${item.id}` || entry.id === item.id || entry.id.startsWith(`gen_${item.id}_`),
        );
        const postId = `ai_post_${campaign.id}_${item.id}`;
        const imagePrompt = buildImagePrompt({ theme: item.theme, angle: item.angle, body: optimized?.improvedText }, profile);
        const imageHint = await generatePostImage(imagePrompt, postId);
        const postProvider = input.provider ?? "INSTAGRAM";
        const hashtags = (optimized?.hashtags ?? []).slice(0, 15);
        const formatMap: Record<string, SaasSocialContentType> = { single: "FEED", carousel: "FEED", reel: "REEL", story: "STORY", article: "FEED" };
        const contentType: SaasSocialContentType = formatMap[item.format] ?? "FEED";
        await upsertSaasSocialPost(ctx, { id: postId, saasId: input.saasId, channelId, campaignId: campaign.id, provider: postProvider, contentType, title: item.theme, body: optimized?.improvedText ?? item.angle, imageHint, status: "DRAFT", scheduledAt: sched?.scheduledAt ?? null, postedAt: null, externalPostId: null, metadata: { targetProvider: postProvider, strategyItemId: item.id, scheduledAt: sched?.scheduledAt ?? null, hashtags, angle: item.angle, callToAction: item.callToAction } });
        savedCount++;
      } catch (postError) {
        console.error(`[SocialFlowOrchestrator] Failed to persist post for item ${item.id}`, postError instanceof Error ? postError.message : String(postError));
      }
    }
    console.log(`[SocialFlowOrchestrator] Saved ${savedCount}/${strategyItems.length} posts for campaign ${campaign.id}`);
    return campaign.id;
  }
}
