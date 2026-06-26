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
    const prompt = `Genera variaciones de posts de alta conversión para la marca ${profile.brandIdentity} en el nicho ${profile.niche}. GENERA TODOS LOS TEXTOS EN ESPAÑOL, con copy completo de al menos 3-5 párrafos.
Tono: ${profile.toneOfVoice}.
Audiencia: ${profile.audience} (buyer persona: ${profile.buyerPersona}).
Puntos de dolor clave: ${profile.painPoints.join(", ")}.
Deseos clave: ${profile.desires.join(", ")}.
Servicios: ${profile.services.join(", ")}.
Ofertas: ${profile.offers.join(", ")}.
Diferenciadores: ${profile.differentiators.join(", ")}.
CTA principal: ${profile.primaryCTA}.
CTAs secundarios: ${profile.secondaryCTAs.join(", ")}.
Señales de mercado: ${profile.marketSignals.join(", ")}.
Temas prohibidos: ${profile.forbiddenTopics.join(", ")}.
Tema de estrategia: ${strategyItem.theme}.
Ángulo de estrategia: ${strategyItem.angle}.
Hooks de tendencia: ${trends.hookIdeas.join(" | \n")}.
Clusters de keywords: ${keywordEngine.clusters.map((c) => c.cluster).join(", ")}.
Usa hashtags de sets evergreen + campaña + viral, máximo 15 hashtags en total, evitando temas prohibidos.
Contexto de marca y base de conocimiento: ${profile.longDescription}`;

    const base: GeneratedPost = {
      id: `gen_${strategyItem.id}`,
      strategyItemId: strategyItem.id,
      variants: [
        {
          id: `gen_${strategyItem.id}_v1`,
          hook: trends.hookIdeas[0] ?? `Lo que nadie te dice sobre ${profile.niche}...`,
          text:
            `Para ${profile.audience.toLowerCase()} que luchan con ${
              profile.painPoints[0] ?? "los desafíos habituales"
            }, aquí tienes una forma concreta de acercarte a "${profile.desires[0] ?? "tu resultado deseado"}".

${strategyItem.angle}.

¿Qué obstáculo te impide llegar ahí? Cuéntanos en los comentarios.

${profile.primaryCTA}.`,
          callToAction: strategyItem.callToAction || profile.primaryCTA,
        },
      ],
    };

    const { data } = await defaultLocalModel.generateStructured<GeneratedPost>({ prompt }, () => base);

    return data;
  }
}
