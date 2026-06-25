import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile } from "../types";

export type TrendInsights = {
  trendingTopics: string[];
  viralAngles: string[];
  emergingPatterns: string[];
  shortFormOpportunities: string[];
  hookIdeas: string[];
};

export class TrendAgent {
  async run(input: { profile: BrandProfile }): Promise<TrendInsights> {
    const { profile } = input;
    const prompt = `Analiza tendencias para el nicho ${profile.niche} y audiencia ${profile.audience} usando señales de mercado, temas virales y tópicos en tendencia. GENERA TODOS LOS TEXTOS EN ESPAÑOL.
Contexto de marca: ${profile.longDescription}`;

    const base: TrendInsights = {
      trendingTopics: [
        ...profile.trendingTopics,
        ...profile.marketSignals.slice(0, 2).map((s) => `Signal: ${s}`),
      ],
      viralAngles: [
        `Antes/después enfocado en resultados de ${profile.niche}`,
        `Detrás de cámaras de cómo entregamos ${profile.services[0] ?? "nuestro servicio principal"}`,
        `Mitos vs realidad sobre ${profile.niche}`,
      ],
      emergingPatterns: [
        `Más contenido educativo corto sobre ${profile.niche} en formato carrusel y reel`,
        `Las audiencias responden a resultados concretos como ${profile.desires[0] ?? "resultados tangibles"}`,
        `Las preguntas sobre ${profile.painPoints[0] ?? "puntos de dolor principales"} siguen apareciendo`,
      ],
      shortFormOpportunities: [
        `Reels de 30-60s abordando "${profile.painPoints[0] ?? "principal punto de dolor"}" con una solución rápida`,
        `Serie de carruseles sobre "${profile.viralThemes[0] ?? "transformación"}" con pasos concretos`,
        `Hooks estilo POV para ${profile.audience.toLowerCase()}`,
      ],
      hookIdeas: [
        `"Nadie te dice esto sobre ${profile.niche}..."`,
        `"Antes de ${profile.primaryCTA.toLowerCase() || "reservar"}, mira esto"`,
        `"Si eres ${profile.audience.toLowerCase()}, lee esto antes de decidir"`,
      ],
    };

    const { data } = await defaultLocalModel.generateStructured<TrendInsights>(
      { prompt },
      () => base,
    );

    return data;
  }
}
