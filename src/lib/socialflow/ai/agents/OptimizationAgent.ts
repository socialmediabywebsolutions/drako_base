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
Usa hashtags de los conjuntos base y prioritarios más los seleccionados del motor de keywords. Máximo 15 hashtags en total.
Texto original: ${variant.text}`;

    const hashtagPool = [
      ...(profile.baseHashtags || []),
      ...(profile.priorityHashtags || []),
      ...(keywordEngine.campaignHashtags || []),
    ];
    const uniqueHashtags = Array.from(new Set(hashtagPool)).slice(0, 15);

    const base: OptimizedPost = {
      id: variant.id,
      baseText: variant.text,
      improvedText: variant.text,
      hashtags: uniqueHashtags,
      tone: profile.toneOfVoice,
    };

    const { data } = await defaultLocalModel.generateStructured<OptimizedPost>(
      { prompt },
      () => base,
    );

    // Enforce max 15 hashtags regardless of what the LLM returned
    if (Array.isArray(data.hashtags) && data.hashtags.length > 15) {
      data.hashtags = data.hashtags.slice(0, 15);
    }

    // Strip any tone-metadata lines that may have leaked from the seed fallback
    if (typeof data.improvedText === "string") {
      data.improvedText = data.improvedText
        .replace(/\n\n(Ajustado al tono|Tone adjusted for)[^\n]*/gi, "")
        .trim();
    }

    return data;
  }
}
