import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile, KeywordCluster, KeywordEngineOutput, KeywordResearch } from "../types";
import type { TrendInsights } from "./TrendAgent";

export class KeywordAgent {
  async run(input: {
    profile: BrandProfile;
    trends: TrendInsights;
  }): Promise<{ research: KeywordResearch; engine: KeywordEngineOutput }> {
    const { profile, trends } = input;
    const mainTopic = profile.niche;
    const prompt = `Generate advanced keyword clusters and hashtag strategy for niche ${profile.niche} using base/priority keywords, hashtags and trend insights.`;

    const awarenessCluster: KeywordCluster = {
      cluster: `${mainTopic} awareness`,
      intent: "awareness",
      difficulty: "low",
      trendScore: 80,
      seasonality: trends.trendingTopics[0] ?? null,
      contentAngles: [
        "Educational explainers",
        `Address pain point: ${profile.painPoints[0] ?? "main pain point"}`,
      ],
      keywords: [
        ...(profile.baseKeywords || []),
        ...(profile.priorityKeywords || []),
      ],
      hashtags: [
        ...(profile.baseHashtags || []),
        ...(profile.priorityHashtags || []),
      ],
    };

    const considerationCluster: KeywordCluster = {
      cluster: `${mainTopic} consideration`,
      intent: "consideration",
      difficulty: "medium",
      trendScore: 65,
      seasonality: null,
      contentAngles: [
        "Comparisons and case studies",
        `Show desired outcome: ${profile.desires[0] ?? "ideal result"}`,
      ],
      keywords: [
        `${mainTopic} pricing`,
        `${mainTopic} providers`,
      ],
      hashtags: [
        ...profile.competitorHashtags,
      ],
    };

    const conversionCluster: KeywordCluster = {
      cluster: `${mainTopic} conversion`,
      intent: "conversion",
      difficulty: "medium",
      trendScore: 70,
      seasonality: null,
      contentAngles: [
        "Strong CTAs and offers",
        `Highlight differentiators: ${profile.differentiators[0] ?? "your edge"}`,
      ],
      keywords: [
        `${mainTopic} offers`,
        `${mainTopic} booking`,
      ],
      hashtags: [
        ...profile.priorityHashtags,
      ],
    };

    const base: { research: KeywordResearch; engine: KeywordEngineOutput } = {
      research: {
        mainTopic,
        clusters: [awarenessCluster, considerationCluster, conversionCluster],
      },
      engine: {
        clusters: [awarenessCluster, considerationCluster, conversionCluster],
        evergreenHashtags: profile.baseHashtags,
        trendingHashtags: trends.trendingTopics.map((t) => `#${t.replace(/\s+/g, "").toLowerCase()}`),
        nicheHashtags: profile.competitorHashtags,
        viralHashtags: profile.viralThemes.map((t) => `#${t.replace(/\s+/g, "").toLowerCase()}`),
        campaignHashtags: profile.priorityHashtags,
      },
    };

    const { data } = await defaultLocalModel.generateStructured<{
      research: KeywordResearch;
      engine: KeywordEngineOutput;
    }>({ prompt }, () => base);

    return data;
  }
}
