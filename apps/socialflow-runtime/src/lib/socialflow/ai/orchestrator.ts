import { getRuntimeChannelKnowledgeFromDb } from "../profile-repository";
import { saveRuntimeCampaign } from "../campaigns-service";
import { saveRuntimePost } from "../posts-service";
import { generateRuntimeId } from "../runtime-repository-core";
import type { RuntimeSocialAIPipelineInput, RuntimeSocialAIPipelineResult, RuntimeBrandProfile, RuntimeCompetitorInsights, RuntimeContentStrategy, RuntimeGeneratedPost, RuntimeKeywordCluster, RuntimeKeywordEngineOutput, RuntimeKeywordResearch, RuntimeMarketResearch, RuntimeOptimizedPost, RuntimeScheduledPostPlan, RuntimeSinglePostGeneration, RuntimeStrategyItem, RuntimeTrendInsights } from "./contracts";
import { createRuntimeAiProvider } from "./provider";

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function toHashtag(value: string) {
  const cleaned = value.replace(/[^a-z0-9]+/gi, "").trim();
  return cleaned ? `#${cleaned.toLowerCase()}` : null;
}

function buildBrandProfile(
  input: RuntimeSocialAIPipelineInput,
  knowledge: Awaited<ReturnType<typeof getRuntimeChannelKnowledgeFromDb>>,
): RuntimeBrandProfile {
  const { profile, competitors, assets } = knowledge;
  const baseKeywords = unique([
    ...profile.baseKeywords,
    ...profile.priorityKeywords,
    profile.niche,
    input.niche,
  ]);
  const priorityKeywords = unique([
    ...profile.priorityKeywords,
    input.niche,
    `${profile.brandName} ${input.niche}`,
  ]);
  const competitorHashtags = unique(
    competitors
      .flatMap((item) => [item.handle ?? "", item.name, ...(item.topContentThemes ?? [])])
      .map((value) => toHashtag(value) ?? ""),
  );

  return {
    brandIdentity: profile.brandName,
    channelHandle: profile.channelName,
    shortDescription: profile.shortDescription || `${input.niche} social operations for ${profile.brandName}.`,
    longDescription: profile.longDescription || `${profile.brandName} runs SocialFlow inside an isolated runtime with tenant-scoped execution.`,
    mission: profile.mission || `Grow ${profile.brandName} with consistent social execution.`,
    valueProposition: profile.valueProposition || `Operational content velocity for ${input.niche}.`,
    toneOfVoice: profile.toneOfVoice || input.tone,
    personality: profile.personality || input.tone,
    niche: profile.niche || input.niche,
    audience: profile.audienceDescription || `${input.niche} buyers`,
    buyerPersona: profile.buyerPersona || `${input.niche} operator`,
    painPoints: unique([...profile.painPoints, ...profile.recurringObjections, input.niche]),
    desires: unique([...profile.desires, ...profile.transformations, "growth"]),
    objections: unique([...profile.objections, ...profile.recurringObjections, "time"]),
    services: unique(profile.services),
    products: unique(profile.products),
    offers: unique(profile.offers),
    differentiators: unique([
      ...profile.differentiators,
      ...competitors.flatMap((item) => item.differentiationOpportunities ?? []),
      assets.length > 0 ? `Owns ${assets.length} tenant-scoped brand assets` : "Tenant-scoped publishing runtime",
    ]),
    primaryCTA: profile.primaryCTA || "Book now",
    secondaryCTAs: unique(profile.secondaryCTAs),
    baseKeywords,
    priorityKeywords,
    longTailKeywords: unique([
      ...profile.longTailKeywords,
      `${input.niche} ${profile.brandName}`,
      `${profile.brandName} social strategy`,
    ]),
    baseHashtags: unique(profile.baseHashtags.concat(baseKeywords.map((value) => toHashtag(value) ?? ""))),
    priorityHashtags: unique(profile.priorityHashtags.concat(priorityKeywords.map((value) => toHashtag(value) ?? ""))),
    competitorHashtags,
    contentPillars: unique([...profile.contentPillars, ...profile.mainTopics, input.niche]),
    preferredFormats: unique(profile.preferredFormats.length > 0 ? profile.preferredFormats : ["carousel", "single"]),
    avoidedFormats: unique(profile.avoidedFormats),
    viralThemes: unique([...profile.viralThemes, ...profile.secondaryTopics]),
    trendingTopics: unique([...profile.trendingTopics, ...profile.industryTrends, ...profile.marketSignals]),
    seasonalTopics: unique(profile.seasonalTopics),
    marketSignals: unique([...profile.marketSignals, ...profile.opportunitySignals]),
    opportunitySignals: unique([...profile.opportunitySignals, ...competitors.flatMap((item) => item.differentiationOpportunities ?? [])]),
    demandSignals: unique([...profile.demandSignals, ...baseKeywords]),
    forbiddenTopics: unique(profile.forbiddenTopics),
    prohibitedClaims: unique(profile.prohibitedClaims),
    bannedWords: unique(profile.bannedWords),
    forbiddenAngles: unique(profile.forbiddenAngles),
  };
}

function buildMarketResearch(profile: RuntimeBrandProfile): RuntimeMarketResearch {
  return {
    trends: unique([
      ...profile.trendingTopics,
      ...profile.marketSignals.map((signal) => `Signal: ${signal}`),
    ]).slice(0, 6),
    competitors: unique(profile.competitorHashtags.map((value) => value.replace(/^#/, ""))).slice(0, 6),
    contentGaps: unique([
      `Transparent explainers about ${profile.niche}`,
      `More concrete examples for ${profile.audience.toLowerCase()}`,
      `Authority content tied to ${profile.primaryCTA.toLowerCase()}`,
    ]),
  };
}

function buildCompetitorInsights(
  profile: RuntimeBrandProfile,
  knowledge: Awaited<ReturnType<typeof getRuntimeChannelKnowledgeFromDb>>,
): RuntimeCompetitorInsights[] {
  if (knowledge.competitors.length > 0) {
    return knowledge.competitors.map((competitor) => ({
      name: competitor.name,
      platform: competitor.platform,
      contentPatterns: competitor.topContentThemes.length > 0 ? competitor.topContentThemes : [`Educational ${profile.niche} explainers`],
      hashtagsUsed: unique([
        ...(competitor.ctaPatterns ?? []).map((value) => toHashtag(value) ?? ""),
        ...(competitor.contentHooksUsed ?? []).map((value) => toHashtag(value) ?? ""),
      ]),
      visualStyle: competitor.visualStyle ?? "Clear proof-oriented creatives",
      postingFrequency: competitor.postingFrequency ?? competitor.postingCadence ?? "3 posts/week",
      engagementSignals: unique([
        competitor.engagementNotes ?? "",
        competitor.engagementQuality ?? "",
      ]),
      strengths: competitor.strengths,
      differentiationOpportunities: competitor.differentiationOpportunities,
      patterns: competitor.topContentThemes,
      winningFormats: competitor.bestFormats,
      hookStyles: competitor.contentHooksUsed,
      hashtagStrategies: competitor.ctaPatterns,
      weaknesses: competitor.weaknesses,
      opportunities: competitor.differentiationOpportunities,
    }));
  }

  return [
    {
      name: `${profile.brandIdentity} benchmark`,
      platform: "linkedin",
      contentPatterns: [`Authority content about ${profile.niche}`, `Proof-driven stories for ${profile.audience}`],
      hashtagsUsed: profile.priorityHashtags.slice(0, 4),
      visualStyle: "Operational proof with concise captions",
      postingFrequency: "4 posts/week",
      engagementSignals: [`Strong interest around ${profile.painPoints[0] ?? profile.niche}`],
      strengths: unique([profile.differentiators[0] ?? "Clear execution"]),
      differentiationOpportunities: unique([profile.differentiators[1] ?? "More social proof"]),
      patterns: unique(profile.contentPillars),
      winningFormats: unique(profile.preferredFormats),
      hookStyles: [`What nobody tells you about ${profile.niche}`],
      hashtagStrategies: profile.priorityHashtags.slice(0, 4),
      weaknesses: unique(profile.objections),
      opportunities: unique(profile.opportunitySignals),
    },
  ];
}

function buildTrendInsights(profile: RuntimeBrandProfile): RuntimeTrendInsights {
  return {
    trendingTopics: unique([
      ...profile.trendingTopics,
      ...profile.marketSignals.slice(0, 2).map((signal) => `Signal: ${signal}`),
    ]),
    viralAngles: unique([
      `Before/after around ${profile.niche}`,
      `Behind the scenes for ${profile.services[0] ?? profile.niche}`,
      `Myths vs reality for ${profile.audience.toLowerCase()}`,
    ]),
    emergingPatterns: unique([
      `Concrete explainers about ${profile.painPoints[0] ?? profile.niche}`,
      `Social proof tied to ${profile.desires[0] ?? "results"}`,
      `Short-form hooks around ${profile.primaryCTA.toLowerCase()}`,
    ]),
    shortFormOpportunities: unique([
      `30-60s clips about ${profile.painPoints[0] ?? profile.niche}`,
      `Carousel series on ${profile.viralThemes[0] ?? profile.niche}`,
      `POV-style hooks for ${profile.audience.toLowerCase()}`,
    ]),
    hookIdeas: unique([
      `Nobody tells you this about ${profile.niche}...`,
      `Before you ${profile.primaryCTA.toLowerCase()}, read this`,
      `If you are a ${profile.audience.toLowerCase()}, save this post`,
    ]),
  };
}

function buildKeywordResearch(profile: RuntimeBrandProfile, trends: RuntimeTrendInsights) {
  const mainTopic = profile.niche;
  const awareness: RuntimeKeywordCluster = {
    cluster: `${mainTopic} awareness`,
    intent: "awareness",
    difficulty: "low",
    trendScore: 80,
    seasonality: trends.trendingTopics[0] ?? null,
    contentAngles: unique([
      "Educational explainers",
      `Address pain point: ${profile.painPoints[0] ?? "main pain point"}`,
    ]),
    keywords: unique([...profile.baseKeywords, ...profile.priorityKeywords]),
    hashtags: unique([...profile.baseHashtags, ...profile.priorityHashtags]),
  };
  const consideration: RuntimeKeywordCluster = {
    cluster: `${mainTopic} consideration`,
    intent: "consideration",
    difficulty: "medium",
    trendScore: 68,
    seasonality: null,
    contentAngles: unique([
      "Comparisons and case studies",
      `Show desired outcome: ${profile.desires[0] ?? "ideal result"}`,
    ]),
    keywords: unique([`${mainTopic} pricing`, `${mainTopic} providers`, ...profile.longTailKeywords.slice(0, 3)]),
    hashtags: unique(profile.competitorHashtags),
  };
  const conversion: RuntimeKeywordCluster = {
    cluster: `${mainTopic} conversion`,
    intent: "conversion",
    difficulty: "medium",
    trendScore: 72,
    seasonality: null,
    contentAngles: unique([
      "Offers and proof",
      `Highlight differentiators: ${profile.differentiators[0] ?? "your edge"}`,
    ]),
    keywords: unique([`${mainTopic} offers`, `${mainTopic} booking`, `${profile.brandIdentity} ${mainTopic}`]),
    hashtags: unique(profile.priorityHashtags),
  };

  const research: RuntimeKeywordResearch = {
    mainTopic,
    clusters: [awareness, consideration, conversion],
  };
  const engine: RuntimeKeywordEngineOutput = {
    clusters: research.clusters,
    evergreenHashtags: unique(profile.baseHashtags),
    trendingHashtags: unique(trends.trendingTopics.map((topic) => toHashtag(topic) ?? "")),
    nicheHashtags: unique(profile.competitorHashtags),
    viralHashtags: unique(profile.viralThemes.map((topic) => toHashtag(topic) ?? "")),
    campaignHashtags: unique(profile.priorityHashtags),
  };

  return { research, engine };
}

function buildStrategy(input: RuntimeSocialAIPipelineInput, profile: RuntimeBrandProfile): RuntimeContentStrategy {
  const horizonDays = Math.max(7, Math.min(30, Math.round((input.frequencyPerWeek / 7) * 30) || 7));
  const items: RuntimeStrategyItem[] = [];
  const pillars = profile.contentPillars.length > 0 ? profile.contentPillars : [profile.niche];
  for (let index = 0; index < horizonDays; index += 1) {
    const theme = pillars[index % pillars.length] ?? profile.niche;
    const format = index % 3 === 0 ? "carousel" : index % 3 === 1 ? "single" : "reel";
    items.push({
      id: `day_${index + 1}`,
      dayOffset: index,
      theme,
      angle:
        index % 3 === 0
          ? `Explain a concrete lesson about ${theme}`
          : index % 3 === 1
            ? `Show how ${profile.brandIdentity} executes ${theme}`
            : `Turn ${theme} into a proof-backed story for ${profile.audience}`,
      format,
      callToAction: index % 3 === 2 ? profile.primaryCTA : (profile.secondaryCTAs[0] ?? "Save this post"),
    });
  }
  return { horizonDays, items };
}

async function generatePostPayloads(
  profile: RuntimeBrandProfile,
  strategyItem: RuntimeStrategyItem,
  keywordEngine: RuntimeKeywordEngineOutput,
  trends: RuntimeTrendInsights,
) {
  const provider = createRuntimeAiProvider();
  const generatedBase: RuntimeGeneratedPost = {
    id: `gen_${strategyItem.id}`,
    strategyItemId: strategyItem.id,
    variants: [
      {
        id: `gen_${strategyItem.id}_v1`,
        hook: trends.hookIdeas[0] ?? `What nobody tells you about ${profile.niche}...`,
        text: `For ${profile.audience.toLowerCase()}, here is a concrete move around ${strategyItem.theme}.\n\n${strategyItem.angle}.\n\n${profile.primaryCTA}.`,
        callToAction: strategyItem.callToAction || profile.primaryCTA,
      },
    ],
  };

  const generatedPrompt = [
    `Write a LinkedIn post for the brand "${profile.brandIdentity}" (${profile.channelHandle || "no handle"}).`,
    `Brand description: ${profile.shortDescription || profile.longDescription || "N/A"}.`,
    `Niche: ${profile.niche}. Audience: ${profile.audience}. Tone of voice: ${profile.toneOfVoice}.`,
    profile.painPoints.length ? `Audience pain points: ${profile.painPoints.join(", ")}.` : "",
    profile.desires.length ? `Audience desires: ${profile.desires.join(", ")}.` : "",
    (profile.services.length || profile.offers.length)
      ? `Services/offers to reference when relevant: ${[...profile.services, ...profile.offers].join(", ")}.`
      : "",
    profile.differentiators.length ? `Key differentiators: ${profile.differentiators.join(", ")}.` : "",
    `Today's content angle: "${strategyItem.theme}" - ${strategyItem.angle} (format: ${strategyItem.format}).`,
    trends.hookIdeas.length ? `Hook ideas to consider: ${trends.hookIdeas.join(" | ")}.` : "",
    `Primary call to action: ${strategyItem.callToAction || profile.primaryCTA}.`,
    (profile.forbiddenTopics.length || profile.bannedWords.length)
      ? `Avoid these topics/words entirely: ${[...profile.forbiddenTopics, ...profile.bannedWords].join(", ")}.`
      : "",
    "Produce a strong scroll-stopping hook, a body text (2-4 short paragraphs) and a clear call to action.",
  ].filter(Boolean).join("\n");

  const generated = (
    await provider.generateStructured({
      prompt: generatedPrompt,
      seed: () => generatedBase,
    })
  ).data;

  const hashtagPool = unique([
    ...profile.baseHashtags,
    ...profile.priorityHashtags,
    ...keywordEngine.campaignHashtags,
  ]).slice(0, 8);

  const optimizedBase: RuntimeOptimizedPost = {
    id: strategyItem.id,
    baseText: generated.variants[0]?.text ?? strategyItem.angle,
    improvedText: `${generated.variants[0]?.text ?? strategyItem.angle}\n\nTone adjusted for ${profile.toneOfVoice}.`,
    hashtags: hashtagPool,
    tone: profile.toneOfVoice,
  };

  const optimizedPrompt = [
    `Refine the following LinkedIn post copy for audience "${profile.audience}" and tone "${profile.toneOfVoice}".`,
    `Keep it on-brand for "${profile.brandIdentity}" and do not invent claims beyond what's given.`,
    (profile.forbiddenTopics.length || profile.bannedWords.length)
      ? `Avoid these topics/words entirely: ${[...profile.forbiddenTopics, ...profile.bannedWords].join(", ")}.`
      : "",
    hashtagPool.length ? `Pick the most relevant hashtags from this set: ${hashtagPool.join(" ")}.` : "",
    `Post copy to refine:\n${optimizedBase.baseText}`,
  ].filter(Boolean).join("\n");

  const optimized = (
    await provider.generateStructured({
      prompt: optimizedPrompt,
      seed: () => optimizedBase,
    })
  ).data;

  return { generated, optimized };
}

function buildSchedule(strategy: RuntimeContentStrategy, frequencyPerWeek: number): RuntimeScheduledPostPlan[] {
  const now = Date.now();
  const spacingHours = Math.max(4, Math.floor((7 * 24) / Math.max(1, frequencyPerWeek)));
  return strategy.items.map((item, index) => ({
    id: `sched_${item.id}`,
    postId: item.id,
    scheduledAt: new Date(now + (item.dayOffset * 24 * 60 * 60 * 1000) + (index * spacingHours * 60 * 60 * 1000)).toISOString(),
  }));
}

export class SocialFlowRuntimeOrchestrator {
  async generateFullCampaign(input: RuntimeSocialAIPipelineInput): Promise<RuntimeSocialAIPipelineResult> {
    const knowledge = await getRuntimeChannelKnowledgeFromDb(input.tenantId);
    const profile = buildBrandProfile(input, knowledge);
    const marketResearch = buildMarketResearch(profile);
    const competitors = buildCompetitorInsights(profile, knowledge);
    const trends = buildTrendInsights(profile);
    const { research, engine } = buildKeywordResearch(profile, trends);
    const strategy = buildStrategy(input, profile);
    const generatedPosts: RuntimeGeneratedPost[] = [];
    const optimizedPosts: RuntimeOptimizedPost[] = [];

    for (const item of strategy.items) {
      const { generated, optimized } = await generatePostPayloads(profile, item, engine, trends);
      generatedPosts.push(generated);
      optimizedPosts.push(optimized);
    }

    const schedule = buildSchedule(strategy, input.frequencyPerWeek);
    const campaign = await saveRuntimeCampaign({
      tenantId: input.tenantId,
      saasId: input.saasId,
      campaign: {
        id: generateRuntimeId("sf_ai_campaign"),
        name: `AI Campaign: ${profile.niche}`,
        objective: "AWARENESS",
        status: "ACTIVE",
        targetSegment: profile.audience || "DEFAULT",
        startDate: schedule[0]?.scheduledAt ?? null,
        endDate: schedule[schedule.length - 1]?.scheduledAt ?? null,
        budgetEstimate: null,
        notes: `Generated inside the isolated SocialFlow runtime for ${profile.brandIdentity}.`,
      },
    });

    for (const item of strategy.items) {
      const optimized = optimizedPosts.find((entry) => entry.id === item.id);
      const scheduled = schedule.find((entry) => entry.postId === item.id);
      await saveRuntimePost({
        tenantId: input.tenantId,
        saasId: input.saasId,
        post: {
          id: `ai_post_${campaign.id}_${item.id}`,
          campaignId: campaign.id,
          provider: "LINKEDIN",
          contentType: "FEED",
          title: item.theme,
          body: optimized?.improvedText ?? item.angle,
          imageHint: null,
          status: scheduled ? "SCHEDULED" : "DRAFT",
          scheduledAt: scheduled?.scheduledAt ?? null,
          postedAt: null,
          externalPostId: null,
          metadata: {
            strategyItemId: item.id,
            callToAction: item.callToAction,
            hashtags: optimized?.hashtags ?? [],
          },
        },
      });
    }

    return {
      profile,
      research,
      keywords: research,
      marketResearch,
      competitors,
      strategy,
      generatedPosts,
      optimizedPosts,
      schedule,
      campaignId: campaign.id,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        objective: campaign.objective,
        status: campaign.status,
      },
    };
  }

  async generateSinglePost(input: RuntimeSocialAIPipelineInput): Promise<RuntimeSinglePostGeneration> {
    const knowledge = await getRuntimeChannelKnowledgeFromDb(input.tenantId);
    const profile = buildBrandProfile(input, knowledge);
    const trends = buildTrendInsights(profile);
    const { engine } = buildKeywordResearch(profile, trends);
    const strategy = buildStrategy({ ...input, frequencyPerWeek: 1 }, profile);
    const strategyItem = strategy.items[0] ?? {
      id: "day_1",
      dayOffset: 0,
      theme: profile.niche,
      angle: `Explain a core concept about ${profile.niche}`,
      format: "single" as const,
      callToAction: profile.primaryCTA,
    };
    const { generated, optimized } = await generatePostPayloads(profile, strategyItem, engine, trends);
    return { profile, strategyItem, generated, optimized };
  }
}
