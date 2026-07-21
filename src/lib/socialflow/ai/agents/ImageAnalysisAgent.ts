import { env } from "@/lib/cf";
import type { BrandProfile } from "../types";

// Correct Workers AI catalog ID — "@cf/llava-1.5-7b-hf" (missing the "llava-hf/"
// namespace) does not exist and throws AiError 5007, silently caught below and
// replaced by the generic fallback. Verified against `wrangler ai models`.
const IMAGE_ANALYSIS_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";

export type ImageAnalysis = {
  description: string;
  emotion: string;
  context: string;
  recommendedPostType: "FEED" | "REEL" | "STORY";
  suggestedThemes: string[];
  // Concrete, category-specific detail extracted from the image (exercise, ingredients,
  // movement, environment...) — the priority input for ContentGeneratorAgent's caption,
  // instead of generic template phrases like "entrenando duro hoy".
  specificContext: string;
};

// Usado cuando no se puede decidir el formato real (LLaVA no disponible, o el campo
// vino inválido/ausente en su respuesta) — un nicho de acción/deporte debe inclinarse
// a REEL por defecto en vez de al FEED genérico.
function nicheDefaultPostType(niche: string): "FEED" | "REEL" | "STORY" {
  const n = niche.toLowerCase();
  if (/fitness|gym|entrenamient|ejercicio|deporte|running|crossfit|yoga|pilates|baile|danza|hiit/.test(n)) {
    return "REEL";
  }
  return "FEED";
}

export class ImageAnalysisAgent {
  async run(input: { imageBytes: number[]; profile: BrandProfile }): Promise<ImageAnalysis> {
    const { imageBytes, profile } = input;

    const fallback: ImageAnalysis = {
      description: `Imagen relacionada con ${profile.niche}`,
      emotion: "profesional y auténtico",
      context: "contenido de marca",
      recommendedPostType: nicheDefaultPostType(profile.niche),
      suggestedThemes: profile.contentPillars.slice(0, 3).length
        ? profile.contentPillars.slice(0, 3)
        : [profile.niche, "detrás de cámaras", "resultados reales"],
      // Honest, non-invented fallback — no fabricated exercise/ingredient/distance data.
      specificContext: profile.contentPillars.slice(0, 2).length
        ? `Contenido relacionado con ${profile.contentPillars.slice(0, 2).join(" y ")}.`
        : `Contenido de ${profile.niche}.`,
    };

    const binding = env()?.AI;
    if (!binding?.run) return fallback;

    // profile.longDescription already carries the tenant's Knowledge Base content
    // (merged in by SocialFlowOrchestrator.buildProfile) when one exists — reuse it
    // here so LLaVA's read of the image is grounded in the brand, not just the niche.
    const brandContext = profile.longDescription?.trim().slice(0, 1200) || "";
    const isEmpresa = profile.accountType === "empresa";

    const prompt = `Analiza esta imagen para una marca de ${profile.niche} llamada "${profile.brandIdentity}".
${brandContext ? `\nContexto de la marca (usa esto para que la descripción y los temas sugeridos encajen con su identidad real):\n${brandContext}\n` : ""}
Esta imagen pertenece probablemente a una de estas categorías. Identifica cuál encaja mejor y extrae el detalle concreto correspondiente para el campo "specificContext":

1. GYM / FUERZA (pesas, mancuernas, barra, máquinas): identifica el ejercicio concreto si es reconocible (press banca, sentadilla, remo, curl bíceps, peso muerto, zancadas, etc.), el grupo muscular que trabaja, y si la postura, el agarre o la carga aparente sugieren esfuerzo/intensidad alta.
2. CUERDAS / ENTRENAMIENTO FUNCIONAL (battle ropes, kettlebells, circuitos): identifica el tipo de movimiento (oleadas, slams, en cruz, lateral) y qué trabaja (core, hombros, cardio).
3. COCINA / NUTRICIÓN (ingredientes visibles: verduras, pimientos, proteína, batidos, bowls): identifica los ingredientes concretos que reconozcas y qué tipo de receta o preparación sugieren (ensalada, salteado, smoothie bowl, meal prep, etc.).
4. RUNNING / OUTDOOR CARDIO: identifica el entorno (parque, montaña, playa, ciudad) e indicios de intensidad SOLO si son visibles (ropa técnica, sudor, terreno, hora del día aparente).
5. OTRAS (outdoor genérico, lifestyle, producto, evento): mantén el nivel de detalle habitual, pero añade siempre 1-2 detalles concretos que realmente veas en la imagen (color, objeto, gesto, entorno) en vez de una frase genérica.

⚠️ REGLA ANTI-INVENCIÓN — OBLIGATORIA: si no puedes identificar con claridad un dato concreto (qué ejercicio exacto es, cuántos km corrió, qué ingrediente exacto es, cuánto tiempo pasó), NUNCA lo inventes ni des una cifra exacta que no puedas ver. Usa lenguaje aproximado y honesto en su lugar (ej. "trabajando la parte superior del cuerpo con pesas" en vez de adivinar "press banca"; "una buena tirada" o "carrera larga" en vez de inventar "5km").

${isEmpresa
  ? `Esta cuenta es de tipo EMPRESA: enfoca "specificContext" hacia el producto o servicio concreto visible en la imagen (qué se ofrece, qué resuelve), en tercera persona, nunca como experiencia personal.`
  : `Esta cuenta es de tipo INFLUENCER: enfoca "specificContext" hacia el detalle personal y motivacional de lo que se ve (el esfuerzo, la sensación, el logro concreto), como si lo viviera la propia creadora en primera persona.`}

Además, decide el campo "recommendedPostType" según estos criterios (elige el que mejor encaje, no asumas un valor por defecto):
- REEL: la imagen transmite movimiento implícito, acción, deporte, ejercicio, energía o dinamismo (ej. corriendo, levantando pesas, bailando, cocinando en plena acción).
- STORY: contenido casual, efímero, íntimo, backstage, un momento cotidiano, selfie informal, o algo que invite a preguntar/interactuar con la audiencia.
- FEED: foto pulida, estática, bien compuesta — retrato, paisaje, producto o contenido evergreen de alta calidad visual.

Responde ÚNICAMENTE con este JSON válido (sin markdown, sin texto extra):
{
  "description": "descripción detallada de qué hay en la imagen en una oración",
  "emotion": "emoción principal que transmite (ej: confianza, alegría, profesionalismo, energía)",
  "context": "contexto visual (ej: interior de negocio, producto, persona, paisaje, evento)",
  "recommendedPostType": "<FEED|REEL|STORY>",
  "suggestedThemes": ["tema relevante 1", "tema relevante 2", "tema relevante 3"],
  "specificContext": "1-2 frases con el detalle concreto y granular de la categoría detectada — es el campo más importante de tu respuesta, sin datos inventados"
}

El campo recommendedPostType debe ser exactamente uno de: "FEED", "REEL" o "STORY", elegido según los criterios de arriba — nunca copies literalmente el placeholder "<FEED|REEL|STORY>".
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
          parsed.recommendedPostType === "REEL" ||
          parsed.recommendedPostType === "STORY" ||
          parsed.recommendedPostType === "FEED"
            ? parsed.recommendedPostType
            : nicheDefaultPostType(profile.niche),
        suggestedThemes:
          Array.isArray(parsed.suggestedThemes) && parsed.suggestedThemes.length > 0
            ? parsed.suggestedThemes
                .slice(0, 5)
                .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
            : fallback.suggestedThemes,
        specificContext:
          typeof parsed.specificContext === "string" && parsed.specificContext.trim()
            ? parsed.specificContext.trim()
            : fallback.specificContext,
      };
    } catch {
      console.error("[ImageAnalysisAgent] LLaVA parse failed, using fallback");
      return fallback;
    }
  }
}
