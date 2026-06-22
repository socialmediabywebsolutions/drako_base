import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile } from "../types";

export type TrendInsights = {
  trendingTopics: string[];
  viralAngles: string[];
  emergingPatterns: string[];
  shortFormOpportunities: string[];
  hookIdeas: string[];
};

export class TrendAgent {
  async run(input: { profile: BrandProfile }): Promise<TrendInsights> {
    const { profile } = input;
    const prompt = `Analyze trends for niche ${profile.niche} and audience ${profile.audience} using market signals, viral themes and trending topics.
Brand context: ${profile.longDescription}`;

    const base: TrendInsights = {
      trendingTopics: [
        ...profile.trendingTopics,
        ...profile.marketSignals.slice(0, 2).map((s) => `Signal: ${s}`),
      ],
      viralAngles: [
        `Before/after focused on ${profile.niche} results`,
        `Behind-the-scenes of how you deliver ${profile.services[0] ?? "your main service"}`,
        `Myths vs reality about ${profile.niche}`,
      ],
      emergingPatterns: [
        `More short-form explainers about ${profile.niche} using carousels and reels`,
        `Audiences respond to concrete outcomes like ${profile.desires[0] ?? "tangible results"}`,
        `Questions around ${profile.painPoints[0] ?? "core pain points"} keep showing up`,
      ],
      shortFormOpportunities: [
        `30-60s reels addressing "${profile.painPoints[0] ?? "main pain point"}" with a quick win`,
        `Carousel series on "${profile.viralThemes[0] ?? "transformation"}" with step-by-step breakdowns`,
        `POV-style hooks about ${profile.audience.toLowerCase()}`,
      ],
      hookIdeas: [
        `"Nobody tells you this about ${profile.niche}..."`,
        `"Before you ${profile.primaryCTA.toLowerCase() || "book"}, watch this"`,
        `"If you are a ${profile.audience.toLowerCase()}, read this before you decide"`,
      ],
    };

    const { data } = await defaultLocalModel.generateStructured<TrendInsights>(
      { prompt },
      () => base,
    );

    return data;
  }
}
