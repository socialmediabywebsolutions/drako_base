import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile } from "../types";

export type TrendInsights = {
  trendingTopics: string[];
  viralAngles: string[];
  emergingPatterns: string[];
  shortFormOpportunities: string[];
  hookIdeas: string[];
  optimalHours: number[];  // UTC hours (0-23) for best engagement with this audience
};

const FITNESS_NICHE_RE = /fitness|lifestyle|wellness|salud|health|gym|sport|yoga|pilates|nutrici|coach|entrenami|ejercici/i;

export class TrendAgent {
  async run(input: { profile: BrandProfile }): Promise<TrendInsights> {
    const { profile } = input;
    const creatorProfile = [profile.ageRange ? `rango de edad ${profile.ageRange}` : "", profile.gender ? `género ${profile.gender}` : ""]
      .filter(Boolean)
      .join(", ");

    const prompt = `Analiza tendencias para el nicho ${profile.niche} y audiencia ${profile.audience} usando señales de mercado, temas virales y tópicos en tendencia. GENERA TODOS LOS TEXTOS EN ESPAÑOL.
Contexto de marca: ${profile.longDescription}
${creatorProfile ? `Perfil del creador (${creatorProfile}) — calibra los ángulos virales y hooks para que encajen con este perfil, sin mencionarlo explícitamente.` : ""}
Además, propón entre 2 y 3 horas óptimas (UTC, formato 24h, números enteros) para publicar contenido de ${profile.niche} en Instagram maximizando el engagement de ${profile.audience}.`;

    const optimalHoursBase = FITNESS_NICHE_RE.test(profile.niche) ? [7, 12, 18] : [9, 18];

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
      optimalHours: optimalHoursBase,
    };

    const { data } = await defaultLocalModel.generateStructured<TrendInsights>(
      { prompt },
      () => base,
    );

    // Validate AI-provided hours — must be 2-3 integers in range 0-23
    const validHours = (data.optimalHours ?? [])
      .filter((h) => Number.isInteger(h) && h >= 0 && h < 24)
      .slice(0, 3);
    data.optimalHours = validHours.length >= 2 ? validHours : optimalHoursBase;

    return data;
  }
}
