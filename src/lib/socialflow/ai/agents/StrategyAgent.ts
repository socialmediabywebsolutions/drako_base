import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile, ContentStrategy, StrategyItem } from "../types";

function buildBaseStrategy(horizonDays: number, niche: string, tone: string): ContentStrategy {
  const items: StrategyItem[] = [];
  for (let i = 0; i < horizonDays; i++) {
    items.push({
      id: `day_${i + 1}`,
      dayOffset: i,
      theme: i % 3 === 0 ? "education" : i % 3 === 1 ? "authority" : "social proof",
      angle:
        i % 3 === 0
          ? `Explain a core concept about ${niche}`
          : i % 3 === 1
          ? `Show expertise and process in ${niche}`
          : `Share a client story in ${niche}`,
      format: i % 2 === 0 ? "carousel" : "reel",
      callToAction:
        i % 3 === 2
          ? "Invite to book a consultation"
          : "Invite to save the post or share with a friend",
    });
  }
  return { horizonDays, items };
}

export class StrategyAgent {
  async run(input: {
    profile: BrandProfile;
    horizonDays: number;
  }): Promise<ContentStrategy> {
    const { profile, horizonDays } = input;
    const prompt = `Design a ${horizonDays}-day content strategy for brand "${profile.brandIdentity}".
Niche: ${profile.niche}.
Tone: ${profile.toneOfVoice}.
Audience: ${profile.audience} (persona: ${profile.buyerPersona}).
Mission: ${profile.mission}.
Value proposition: ${profile.valueProposition}.
Content pillars: ${profile.contentPillars.join(", ")}.
Services: ${profile.services.join(", ")}.
Offers: ${profile.offers.join(", ")}.
Pain points to address: ${profile.painPoints.join(", ")}.
Desires to tap into: ${profile.desires.join(", ")}.
Preferred formats: ${profile.preferredFormats.join(", ")}.
Forbidden topics: ${profile.forbiddenTopics.join(", ")}.
Brand context: ${profile.longDescription}`;

    const base = buildBaseStrategy(horizonDays, profile.niche, profile.toneOfVoice);

    const { data } = await defaultLocalModel.generateStructured<ContentStrategy>(
      { prompt },
      () => base,
    );

    return data;
  }
}
