import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile, MarketResearch } from "../types";

export class MarketResearchAgent {
  async run(input: { profile: BrandProfile }): Promise<MarketResearch> {
    const prompt = `You are a market research assistant for a SaaS that helps salons and clinics.
Niche: ${input.profile.niche}
Audience: ${input.profile.audience}
Services: ${input.profile.services.join(", ")}

Return short bullet-point trends, competitors, and content gaps.`;

    const base: MarketResearch = {
      trends: [
        `Growing demand for ${input.profile.niche} transformation stories`,
        "Increased interest in behind-the-scenes and process content",
      ],
      competitors: ["Local competitors", "Category leaders", "Influencer brands"],
      contentGaps: [
        "Few educational threads that explain pricing transparently",
        "Little content about long-term results and retention",
      ],
    };

    const { data } = await defaultLocalModel.generateStructured<MarketResearch>(
      { prompt },
      () => base,
    );

    return data;
  }
}
