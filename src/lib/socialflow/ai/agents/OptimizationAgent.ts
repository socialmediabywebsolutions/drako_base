import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile, KeywordEngineOutput, OptimizedPost } from "../types";

export class OptimizationAgent {
  async run(input: {
    profile: BrandProfile;
    variant: { id: string; text: string; hook: string; callToAction: string };
    keywordEngine: KeywordEngineOutput;
  }): Promise<OptimizedPost> {
    const { profile, variant, keywordEngine } = input;
    const prompt = `Optimize this post for tone ${profile.toneOfVoice} for audience ${profile.audience}.
Avoid forbidden topics (${profile.forbiddenTopics.join(", ")} and angles ${profile.forbiddenAngles.join(", ")}).
Avoid banned words: ${profile.bannedWords.join(", ")}.
Use hashtags from base and priority sets plus selected engine hashtags.
Text: ${variant.text}`;

    const hashtagPool = [
      ...(profile.baseHashtags || []),
      ...(profile.priorityHashtags || []),
      ...(keywordEngine.campaignHashtags || []),
    ];
    const uniqueHashtags = Array.from(new Set(hashtagPool)).slice(0, 8);

    const base: OptimizedPost = {
      id: variant.id,
      baseText: variant.text,
      improvedText: `${variant.text}\n\nAdjusted to tone: ${profile.toneOfVoice}.`,
      hashtags: uniqueHashtags,
      tone: profile.toneOfVoice,
    };

    const { data } = await defaultLocalModel.generateStructured<OptimizedPost>(
      { prompt },
      () => base,
    );

    return data;
  }
}
