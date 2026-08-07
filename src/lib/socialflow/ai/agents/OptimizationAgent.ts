import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile, KeywordEngineOutput, OptimizedPost } from "../types";
import { resolveObjectiveCta } from "../utils/ctaUtils";
import { extractVoiceSection } from "../utils/voiceUtils";

export class OptimizationAgent {
  async run(input: {
    profile: BrandProfile;
    variant: { id: string; text: string; hook: string; callToAction: string };
    keywordEngine: KeywordEngineOutput;
  }): Promise<OptimizedPost> {
    const { profile, variant, keywordEngine } = input;
    const voiceSection = extractVoiceSection(profile.longDescription);
    const prompt = `${profile.voiceInstruction ? `⚠️ VOZ OBLIGATORIA: ${profile.voiceInstruction}\n\n` : ""}${voiceSection ? `${voiceSection}\n\n` : ""}Optimiza este post en ESPAÑOL para el tono "${profile.toneOfVoice}" y la audiencia "${profile.audience}". El texto mejorado debe estar completamente en español y ser persuasivo.
Mantén el texto CORTO: máximo 3-4 líneas impactantes, nunca párrafos largos. No alargues el texto original.
Nunca empieces la primera línea con "A veces", "Hola" ni "Chicas".
Evita temas prohibidos (${profile.forbiddenTopics.join(", ")} y ángulos ${profile.forbiddenAngles.join(", ")}).
Evita palabras prohibidas: ${profile.bannedWords.join(", ")}.
Mantén entre 10 y 15 hashtags en el post. Si hay menos de 10, añade hashtags relevantes al nicho. Si hay más de 15, elimina los menos relevantes.
El texto debe estar en primera persona singular (yo, mi, me). Si encuentras "nosotros", "nuestro" o "nuestra", cámbialo a primera persona.
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

    // Enforce min 10 hashtags — pad with fitness defaults if the LLM returned too few
    if (Array.isArray(data.hashtags) && data.hashtags.length < 10) {
      const extraFitnessHashtags = ['#FitnessMotivacion', '#VidaSaludable', '#EntrenamientoEnCasa', '#NutricionSaludable', '#MujerFit', '#HabitosSaludables', '#FitnessLatina', '#SaludYBienestar', '#BodyPositive', '#MindfulEating', '#FitnessCommunity', '#ActiveLifestyle'];
      const needed = 10 - data.hashtags.length;
      data.hashtags = [...data.hashtags, ...extraFitnessHashtags.slice(0, needed)];
    }

    // Strip any tone-metadata lines that may have leaked from the seed fallback
    if (typeof data.improvedText === "string") {
      data.improvedText = data.improvedText
        .replace(/\n\n(Ajustado al tono|Tone adjusted for)[^\n]*/gi, "")
        .trim();
    }

    // CTA por objetivo — añadido DESPUÉS de que Mistral optimice el texto, el último
    // paso real del pipeline de Post/Reel/Historia (ContentGeneratorAgent no lo es,
    // este agente corre después y reescribe el texto completo). Mismo criterio que ya
    // usa Carrusel con su slide cierre_cta: frase fija en código, nunca sujeta a lo que
    // decida reescribir la IA. ContentGeneratorAgent ya omite su propio CTA genérico
    // cuando hay objetivo configurado (ver ese archivo), así que esto nunca duplica un
    // CTA existente.
    const objectiveCta = resolveObjectiveCta(profile.clientObjective, profile.channelHandle);
    if (objectiveCta && typeof data.improvedText === "string") {
      data.improvedText = `${data.improvedText}\n\n${objectiveCta}`;
    }

    return data;
  }
}
