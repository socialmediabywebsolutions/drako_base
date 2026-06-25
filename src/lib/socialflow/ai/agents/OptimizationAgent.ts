import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile, KeywordEngineOutput, OptimizedPost } from "../types";

export class OptimizationAgent {
  async run(input: {
    profile: BrandProfile;
    variant: { id: string; text: string; hook: string; callToAction: string };
    keywordEngine: KeywordEngineOutput;
  }): Promise<OptimizedPost> {
    const { profile, variant, keywordEngine } = input;
    const prompt = `Optimiza este post en ESPAÑOL para el tono "${profile.toneOfVoice}" y la audiencia "${profile.audience}". El texto mejorado debe estar completamente en español, ser persuasivo y tener al menos 3 párrafos.
Evita temas prohibidos (${profile.forbiddenTopics.join(", ")} y ángulos ${profile.forbiddenAngles.join(", ")}).
Evita palabras prohibidas: ${profile.bannedWords.join(", ")}.
Usa hashtags de los conjuntos base y prioritarios más los seleccionados del motor de keywords.
Texto original: ${variant.text}`;

    const hashtagPool = [
      ...(profile.baseHashtags || []),
      ...(profile.priorityHashtags || []),
      ...(keywordEngine.campaignHashtags || []),
    ];
    const uniqueHashtags = Array.from(new Set(hashtagPool)).slice(0, 8);

    const base: OptimizedPost = {
      id: variant.id,
      baseText: variant.text,
      improvedText: `${variant.text}\n\nAjustado al tono: ${profile.toneOfVoice}.`,
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
