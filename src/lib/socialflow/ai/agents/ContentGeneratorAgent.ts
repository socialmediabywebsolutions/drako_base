import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile, GeneratedPost, KeywordEngineOutput } from "../types";
import type { TrendInsights } from "./TrendAgent";

export class ContentGeneratorAgent {
  async run(input: {
    profile: BrandProfile;
    strategyItem: { id: string; theme: string; angle: string; callToAction: string };
    keywordEngine: KeywordEngineOutput;
    trends: TrendInsights;
  }): Promise<GeneratedPost> {
    const { profile, strategyItem, keywordEngine, trends } = input;
    const prompt = `Generate high-converting post variations for brand ${profile.brandIdentity} in niche ${profile.niche}.
Tone: ${profile.toneOfVoice}.
Audience: ${profile.audience} (buyer persona: ${profile.buyerPersona}).
Key pain points: ${profile.painPoints.join(", ")}.
Key desires: ${profile.desires.join(", ")}.
Services: ${profile.services.join(", ")}.
Offers: ${profile.offers.join(", ")}.
Differentiators: ${profile.differentiators.join(", ")}.
Primary CTA: ${profile.primaryCTA}.
Secondary CTAs: ${profile.secondaryCTAs.join(", ")}.
Market signals: ${profile.marketSignals.join(", ")}.
Forbidden topics: ${profile.forbiddenTopics.join(", ")}.
Strategy theme: ${strategyItem.theme}.
Strategy angle: ${strategyItem.angle}.
Trend hooks: ${trends.hookIdeas.join(" | \n")}.
Keyword clusters: ${keywordEngine.clusters.map((c) => c.cluster).join(", ")}.
Use hashtags from evergreen + campaign + viral sets, avoiding forbidden topics.`;

    const base: GeneratedPost = {
      id: `gen_${strategyItem.id}`,
      strategyItemId: strategyItem.id,
      variants: [
        {
          id: `gen_${strategyItem.id}_v1`,
          hook: trends.hookIdeas[0] ?? `What nobody tells you about ${profile.niche}...`,
          text:
            `For ${profile.audience.toLowerCase()}, struggling with ${
              profile.painPoints[0] ?? "the usual challenges"
            }, here is a concrete way to get closer to "${profile.desires[0] ?? "your desired outcome"}".

${strategyItem.angle}.

${profile.primaryCTA}.`,
          callToAction: strategyItem.callToAction || profile.primaryCTA,
        },
      ],
    };

    const { data } = await defaultLocalModel.generateStructured<GeneratedPost>({ prompt }, () => base);

    return data;
  }
}
