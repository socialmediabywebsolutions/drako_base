import { defaultLocalModel } from "../models/localModel";
import type { ContentStrategy, StrategyItem } from "../types";

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
    profileNiche: string;
    tone: string;
    horizonDays: number;
  }): Promise<ContentStrategy> {
    const prompt = `Design a ${input.horizonDays}-day content strategy for niche: ${
      input.profileNiche
    } with tone: ${input.tone}.`;

    const base = buildBaseStrategy(input.horizonDays, input.profileNiche, input.tone);

    const { data } = await defaultLocalModel.generateStructured<ContentStrategy>(
      { prompt },
      () => base,
    );

    return data;
  }
}
