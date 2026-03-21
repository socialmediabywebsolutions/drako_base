import { defaultLocalModel } from "../models/localModel";
import type { CompetitorInsights } from "../types";

export class CompetitorAgent {
  async run(input: { niche: string }): Promise<CompetitorInsights[]> {
    const prompt = `Analyze competitor patterns for niche: ${input.niche}. Return rich intelligence including patterns, formats, hooks, hashtags, weaknesses and opportunities.`;

    const base: CompetitorInsights[] = [
      {
        name: "TopLocalSalon",
        platform: "instagram",
        contentPatterns: [
          "Before/after result carousels",
          "Client testimonial reels with on-screen captions",
          "Quick tip stories with polls",
        ],
        hashtagsUsed: ["#localsalon", "#hairgoals", "#beforeafter"],
        visualStyle: "Bright, warm, close-up transformation shots with bold text overlays",
        postingFrequency: "5 posts/week",
        engagementSignals: [
          "High saves on transformation carousels",
          "Many comments asking about pricing and availability",
          "Story polls get consistent responses",
        ],
        strengths: [
          "Strong visual branding",
          "Consistent posting cadence",
          "Clear focus on transformations",
        ],
        differentiationOpportunities: [
          "Deeper educational breakdowns of processes",
          "More behind-the-scenes to humanize the team",
          "More explicit calls to action for bookings",
        ],
        // Advanced intelligence
        patterns: [
          "Transformation-focused content dominates top performing posts",
          "Short, punchy captions with 1–2 lines of copy",
          "Frequent use of question hooks to drive comments",
        ],
        winningFormats: [
          "Before/after carousels with step-by-step captions",
          "Vertical reels with trending audio",
        ],
        hookStyles: [
          '"What nobody tells you about..." style hooks',
          '"Before you book your next treatment, read this" hooks',
          "Numbered list hooks like '3 mistakes you are making...'",
        ],
        hashtagStrategies: [
          "Mix of local geo hashtags + niche service hashtags",
          "Keeps a small core set of branded hashtags across posts",
          "Uses 1–2 trending hashtags sparingly",
        ],
        weaknesses: [
          "Few long-form educational posts to build authority",
          "Limited proof of long-term client results",
          "Calls to action are often implicit instead of explicit",
        ],
        opportunities: [
          "Create series-based content (e.g. weekly transformation series)",
          "Introduce more booking-focused CTAs",
          "Leverage more user-generated content and testimonials",
        ],
      },
    ];

    const { data } = await defaultLocalModel.generateStructured<CompetitorInsights[]>(
      { prompt },
      () => base,
    );

    return data;
  }
}
