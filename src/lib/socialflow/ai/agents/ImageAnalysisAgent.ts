import { env } from "@/lib/cf";
import type { BrandProfile } from "../types";

const IMAGE_ANALYSIS_MODEL = "@cf/llava-1.5-7b-hf";

export type ImageAnalysis = {
  description: string;
  emotion: string;
  context: string;
  recommendedPostType: "FEED" | "REEL" | "STORY";
  suggestedThemes: string[];
};

export class ImageAnalysisAgent {
  async run(input: { imageBytes: number[]; profile: BrandProfile }): Promise<ImageAnalysis> {
    const { imageBytes, profile } = input;

    const fallback: ImageAnalysis = {
      description: `Imagen relacionada con ${profile.niche}`,
      emotion: "profesional y auténtico",
      context: "contenido de marca",
      recommendedPostType: "FEED",
      suggestedThemes: profile.contentPillars.slice(0, 3).length
        ? profile.contentPillars.slice(0, 3)
        : [profile.niche, "detrás de cámaras", "resultados reales"],
    };

    const binding = env()?.AI;
    if (!binding?.run) return fallback;

    const prompt = `Analiza esta imagen para una marca de ${profile.niche} llamada "${profile.brandIdentity}".

Responde ÚNICAMENTE con este JSON válido (sin markdown, sin texto extra):
{
  "description": "descripción detallada de qué hay en la imagen en una oración",
  "emotion": "emoción principal que transmite (ej: confianza, alegría, profesionalismo, energía)",
  "context": "contexto visual (ej: interior de negocio, producto, persona, paisaje, evento)",
  "recommendedPostType": "FEED",
  "suggestedThemes": ["tema relevante 1", "tema relevante 2", "tema relevante 3"]
}

El campo recommendedPostType debe ser exactamente uno de: "FEED", "REEL" o "STORY".
Los temas deben ser relevantes para el nicho: ${profile.niche}.
Responde TODO en español.`;

    try {
      const result = (await binding.run(IMAGE_ANALYSIS_MODEL, {
        prompt,
        image: imageBytes,
        max_tokens: 512,
      })) as { description?: string } | null;

      const raw = result?.description ?? "";
      const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) return fallback;

      const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as Partial<ImageAnalysis>;

      return {
        description:
          typeof parsed.description === "string" && parsed.description.trim()
            ? parsed.description.trim()
            : fallback.description,
        emotion:
          typeof parsed.emotion === "string" && parsed.emotion.trim()
            ? parsed.emotion.trim()
            : fallback.emotion,
        context:
          typeof parsed.context === "string" && parsed.context.trim()
            ? parsed.context.trim()
            : fallback.context,
        recommendedPostType:
          parsed.recommendedPostType === "REEL" || parsed.recommendedPostType === "STORY"
            ? parsed.recommendedPostType
            : "FEED",
        suggestedThemes:
          Array.isArray(parsed.suggestedThemes) && parsed.suggestedThemes.length > 0
            ? parsed.suggestedThemes
                .slice(0, 5)
                .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
            : fallback.suggestedThemes,
      };
    } catch {
      console.error("[ImageAnalysisAgent] LLaVA parse failed, using fallback");
      return fallback;
    }
  }
}
