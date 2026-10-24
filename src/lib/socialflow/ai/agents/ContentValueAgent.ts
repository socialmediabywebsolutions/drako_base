import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile } from "../types";
import { getNicheIntelligence } from "@/lib/socialflow/intelligence/NicheIntelligenceService";
import { env } from "@/lib/cf";

// Enriquece el specificContext de ImageAnalysisAgent con contenido técnico/educativo
// real por categoría (fitness/nutrición/viajes/lifestyle/empresa) — el vacío que
// ImageAnalysisAgent deja a propósito (su regla anti-invención le impide dar detalles
// que no puede ver en la imagen, ver ese archivo). ContentValueAgent no intenta "ver
// más" en la foto — da consejos/datos GENÉRICOS y educativos sobre lo que ya se
// identificó, nunca afirma medir algo específico de ESTA imagen que no venga del
// cliente (userNote) o del conocimiento del negocio (KB). Corre entre
// ImageAnalysisAgent y ContentGeneratorAgent, solo en generate-from-image/route.ts
// (flujo single-photo y carrusel-con-fotos) — no en campañas ni en carrusel 100% IA.

export type ContentValueCategory = "fitness" | "nutricion" | "viajes" | "lifestyle" | "empresa" | "generico";

export type ContentValueResult = {
  category: ContentValueCategory;
  valuePoints: string[];
  practicalTip: string | null;
  // specificContext original + el valor añadido — pensado como reemplazo directo de
  // specificContext en el punto de inyección que ya existe en ContentGeneratorAgent
  // ("DETALLE VISUAL CONCRETO — PRIORIDAD MÁXIMA"), sin tocar ese prompt. Siempre
  // empieza por el specificContext real, así el detalle visual nunca se pierde aunque
  // Mistral devuelva poco.
  enrichedContext: string;
};

type ContentValueAiFields = {
  category: ContentValueCategory;
  valuePoints: string[];
  practicalTip: string | null;
};

const VALID_CATEGORIES: ContentValueCategory[] = ["fitness", "nutricion", "viajes", "lifestyle", "empresa", "generico"];

export class ContentValueAgent {
  async run(input: {
    profile: BrandProfile;
    specificContext: string;
    userNote?: string;
    tenantId?: string;
    saasId?: string;
  }): Promise<ContentValueResult | null> {
    const { profile } = input;
    const specificContext = input.specificContext?.trim() ?? "";
    const userNote = input.userNote?.trim().slice(0, 200) ?? "";

    if (!specificContext && !userNote) return null;

    const dracoEnv = env();
    const nicheIntel = dracoEnv
      ? await getNicheIntelligence(profile.niche, dracoEnv, input.tenantId, input.saasId, profile.accountType ?? "influencer")
      : null;

    // Mismo patrón que ImageAnalysisAgent.ts (brandContext) para inyectar KB sin
    // depender de una utilidad de extracción por sección — aquí interesa el bloque
    // completo (catálogo/precio incluido), no solo una parte.
    const kbExtract = profile.longDescription?.trim().slice(0, 1200) || "";

    const nicheIntelSection = nicheIntel
      ? `\nTENDENCIAS DEL NICHO ESTA SEMANA (para alinear tono/formato, no como fuente de datos técnicos): ${nicheIntel.hooks.join(" | ")}\n`
      : "";

    const prompt = `Eres un experto en ${profile.niche} escribiendo contenido educativo de valor real para redes sociales.

DETALLE VISUAL IDENTIFICADO: "${specificContext || "(sin detalle visual — usa solo el dato del cliente de abajo)"}"
${userNote ? `\n⚠️ DATO DIRECTO DEL CLIENTE — PRIORIDAD MÁXIMA (más fiable que cualquier inferencia visual, úsalo como la verdad): "${userNote}"\n` : ""}
${kbExtract ? `\nCONOCIMIENTO DEL NEGOCIO:\n${kbExtract}\n` : ""}
${nicheIntelSection}
Categoriza este contenido en UNA de: fitness, nutricion, viajes, lifestyle, empresa, generico (usa "generico" si ninguna encaja con claridad).

Según la categoría, añade 1-3 datos de VALOR REAL:
- fitness: técnica correcta del ejercicio identificado, qué músculos trabaja, un rango orientativo genérico de series/repeticiones (ej. "3-4 series de 10-12 repeticiones suele ser un buen punto de partida") — NUNCA lo presentes como si fuera lo que hay exactamente en ESTA foto, es una referencia general.
- nutricion: beneficio nutricional de los ingredientes identificados + un rango aproximado de calorías si es razonable estimarlo por el tipo de plato (ej. "aprox. 300-400 kcal"), dejando claro que es una estimación general, nunca una cifra exacta de esta porción específica.
- viajes: un dato histórico/cultural real y verificable del lugar identificado + una recomendación práctica.
- lifestyle: el beneficio concreto del momento/actividad + una conexión emocional genuina.
- empresa: la característica más destacada del producto/servicio visible + el precio SOLO si aparece en el conocimiento del negocio de arriba, nunca inventado.

⚠️ REGLA: puedes dar consejos y datos GENÉRICOS/educativos sobre la categoría (es tu trabajo). NUNCA afirmes un dato específico sobre ESTA imagen en particular (peso exacto, repeticiones exactas, precio exacto) a menos que venga del DATO DIRECTO DEL CLIENTE o del CONOCIMIENTO DEL NEGOCIO.

Responde SOLO con este JSON: {"category": "fitness|nutricion|viajes|lifestyle|empresa|generico", "valuePoints": ["...", "..."], "practicalTip": "..." o null}`;

    const seed: ContentValueAiFields = { category: "generico", valuePoints: [], practicalTip: null };

    const { data, isFallback } = await defaultLocalModel.generateStructured<ContentValueAiFields>(
      { prompt, tenantId: input.tenantId, saasId: input.saasId },
      () => seed,
    );

    // Degrada a null en vez de lanzar — nunca debe bloquear la generación de
    // contenido; el caller usa el specificContext original tal cual si esto falla.
    if (isFallback) return null;

    const category = VALID_CATEGORIES.includes(data.category) ? data.category : "generico";
    const valuePoints = Array.isArray(data.valuePoints) ? data.valuePoints.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
    const practicalTip = typeof data.practicalTip === "string" && data.practicalTip.trim() ? data.practicalTip.trim() : null;

    if (valuePoints.length === 0 && !practicalTip) return null;

    const enrichedContext = [specificContext, ...valuePoints, practicalTip].filter(Boolean).join(" ");

    return { category, valuePoints, practicalTip, enrichedContext };
  }
}
