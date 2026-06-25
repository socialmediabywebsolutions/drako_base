import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile, ContentStrategy, StrategyItem } from "../types";

function buildBaseStrategy(horizonDays: number, niche: string, tone: string): ContentStrategy {
  const items: StrategyItem[] = [];
  for (let i = 0; i < horizonDays; i++) {
    items.push({
      id: `day_${i + 1}`,
      dayOffset: i,
      theme: i % 3 === 0 ? "educación" : i % 3 === 1 ? "autoridad" : "prueba social",
      angle:
        i % 3 === 0
          ? `Explica un concepto clave sobre ${niche}`
          : i % 3 === 1
          ? `Muestra tu experiencia y proceso en ${niche}`
          : `Comparte un caso de éxito de cliente en ${niche}`,
      format: i % 2 === 0 ? "carousel" : "reel",
      callToAction:
        i % 3 === 2
          ? "Invita a agendar una consulta"
          : "Invita a guardar el post o compartirlo con un amigo",
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
    const prompt = `Diseña una estrategia de contenido de ${horizonDays} posts para la marca "${profile.brandIdentity}". GENERA TODOS LOS TEXTOS EN ESPAÑOL.
Nicho: ${profile.niche}.
Tono: ${profile.toneOfVoice}.
Audiencia: ${profile.audience} (persona: ${profile.buyerPersona}).
Misión: ${profile.mission}.
Propuesta de valor: ${profile.valueProposition}.
Pilares de contenido: ${profile.contentPillars.join(", ")}.
Servicios: ${profile.services.join(", ")}.
Ofertas: ${profile.offers.join(", ")}.
Puntos de dolor a abordar: ${profile.painPoints.join(", ")}.
Deseos a activar: ${profile.desires.join(", ")}.
Formatos preferidos: ${profile.preferredFormats.join(", ")}.
Temas prohibidos: ${profile.forbiddenTopics.join(", ")}.
Contexto de marca: ${profile.longDescription}`;

    const base = buildBaseStrategy(horizonDays, profile.niche, profile.toneOfVoice);

    const { data } = await defaultLocalModel.generateStructured<ContentStrategy>(
      { prompt },
      () => base,
    );

    return data;
  }
}
