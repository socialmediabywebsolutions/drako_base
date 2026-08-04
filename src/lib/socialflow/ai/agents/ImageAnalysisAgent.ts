import { env } from "@/lib/cf";
import type { BrandProfile } from "../types";
import { getEmployeeContext } from "@/lib/socialflow/employees/repository";
import { getLocalContext } from "@/lib/socialflow/local/repository";

// Llama 3.2 11B Vision Instruct — reemplaza a LLaVA-1.5-7B (mismo shape de entrada
// prompt+image, pero el campo de salida es "response", no "description"; ver parsing
// más abajo). Más capaz y con mucho más contexto (128k) que el 7B anterior. Verificado
// contra el registro AiModels de @cloudflare/workers-types instalado en el proyecto.
const IMAGE_ANALYSIS_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

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
  // Structured classification of the TYPE of moment the photo captures, independent of
  // niche/category — this is what lets ContentGeneratorAgent decide FEED/REEL/STORY
  // without relying on hardcoded per-niche keywords in specificContext's free text.
  momentType: "accion" | "intimo_personal" | "estatico_compuesto";
  // Nombre del empleado reconocido en la imagen (solo cuentas empresa con empleados
  // registrados y una señal visual razonable) — null si no aplica.
  employeeDetected: string | null;
  // true cuando LLaVA falló (binding no disponible, JSON no parseable, o cualquier
  // excepción) y este resultado es la plantilla genérica basada en el nicho del perfil,
  // sin relación real con la imagen. Ausente/false = análisis real de LLaVA.
  degraded?: boolean;
};

// Usado cuando no se puede decidir el formato real (LLaVA no disponible, o el campo
// vino inválido/ausente en su respuesta) — un nicho de acción/deporte debe inclinarse
// a REEL por defecto en vez de al FEED genérico.
export function nicheDefaultPostType(niche: string): "FEED" | "REEL" | "STORY" {
  const n = niche.toLowerCase();
  if (/fitness|gym|entrenamient|ejercicio|deporte|running|crossfit|yoga|pilates|baile|danza|hiit/.test(n)) {
    return "REEL";
  }
  return "FEED";
}

// Mismo criterio que nicheDefaultPostType, pero como momentType — usado en el fallback
// de ImageAnalysisAgent cuando no hay señal visual real que clasificar.
function nicheDefaultMomentType(niche: string): "accion" | "intimo_personal" | "estatico_compuesto" {
  return nicheDefaultPostType(niche) === "REEL" ? "accion" : "estatico_compuesto";
}

// Seed determinista derivado de los bytes de ESTA imagen — lo único que realmente
// difiere entre dos fotos cuando este fallback se activa (LLaVA no disponible, error,
// o JSON inválido). Usado para rotar qué content pillar encabeza el fallback, así dos
// imágenes distintas de la misma tanda nunca producen un ImageAnalysis idéntico —
// y por tanto nunca el mismo strategyItem.theme/angle ni el mismo caption final (ver
// ContentGeneratorAgent, que deriva ambos directamente de este resultado).
function imageByteSeed(imageBytes: number[]): number {
  if (!imageBytes.length) return 0;
  let hash = 0;
  const sampleStep = Math.max(1, Math.floor(imageBytes.length / 64));
  for (let i = 0; i < imageBytes.length; i += sampleStep) {
    hash = (hash * 31 + imageBytes[i]) >>> 0;
  }
  return hash;
}

function rotate<T>(items: T[], seed: number): T[] {
  if (items.length < 2) return items;
  const offset = seed % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

export class ImageAnalysisAgent {
  async run(input: {
    imageBytes: number[];
    profile: BrandProfile;
    tenantId?: string;
    saasId?: string;
  }): Promise<ImageAnalysis> {
    const { imageBytes, profile } = input;

    // Rotado por imageByteSeed — si hay 2+ pillars (o se cae al trío genérico de abajo),
    // cada imagen de la tanda encabeza con uno distinto en vez de repetir siempre el
    // mismo orden fijo. Con 0-1 pillars configurados no hay señal que rotar; ese caso
    // límite se queda igual para todas las imágenes (perfil mínimamente configurado).
    const basePillars = profile.contentPillars.length
      ? profile.contentPillars
      : [profile.niche, "detrás de cámaras", "resultados reales"];
    const pillars = rotate(basePillars, imageByteSeed(imageBytes));

    const fallback: ImageAnalysis = {
      description: `Imagen relacionada con ${profile.niche}`,
      emotion: "profesional y auténtico",
      context: pillars[0] ?? "contenido de marca",
      recommendedPostType: nicheDefaultPostType(profile.niche),
      suggestedThemes: pillars.slice(0, 3),
      // Honest, non-invented fallback — no fabricated exercise/ingredient/distance data.
      specificContext: pillars.slice(0, 2).length
        ? `Contenido relacionado con ${pillars.slice(0, 2).join(" y ")}.`
        : `Contenido de ${profile.niche}.`,
      momentType: nicheDefaultMomentType(profile.niche),
      employeeDetected: null,
      degraded: true,
    };

    const binding = env()?.AI;
    if (!binding?.run) {
      console.error("[ImageAnalysisAgent] AI binding no disponible (env().AI es null/undefined)");
      return fallback;
    }

    // profile.longDescription already carries the tenant's Knowledge Base content
    // (merged in by SocialFlowOrchestrator.buildProfile) when one exists — reuse it
    // here so LLaVA's read of the image is grounded in the brand, not just the niche.
    const brandContext = profile.longDescription?.trim().slice(0, 1200) || "";
    const isEmpresa = profile.accountType === "empresa";

    // Solo cuentas empresa cargan contexto de empleados — un influencer no tiene equipo.
    const employeeContext =
      isEmpresa && input.tenantId && input.saasId
        ? await getEmployeeContext(input.tenantId, input.saasId).catch(() => "")
        : "";
    const localContext =
      isEmpresa && input.tenantId && input.saasId
        ? await getLocalContext(input.tenantId, input.saasId).catch(() => "")
        : "";

    const prompt = `PASO 1 — DESCRIPCIÓN OBJETIVA (haz esto ANTES de pensar en cualquier nicho o tema de marca):
Mira la imagen y describe con precisión qué aparece REALMENTE en ella — personas, animales, objetos, entorno, acciones visibles. No asumas todavía ningún tema, nicho o categoría de negocio; describe solo lo que ves.

Recuerda desde ya: tu respuesta FINAL a este mensaje debe ser ÚNICAMENTE un JSON válido (sin markdown, sin texto extra, sin explicaciones antes ni después) — el formato exacto se detalla al final de este mensaje.

PASO 2 — CONTEXTO DE LA MARCA:
Esta imagen es para una marca de ${profile.niche} llamada "${profile.brandIdentity}".
${brandContext ? `\nContexto de la marca (usa esto para que la descripción y los temas sugeridos encajen con su identidad real):\n${brandContext}\n` : ""}
${localContext ? `\nCONTEXTO DEL LOCAL: ${localContext}\nUsa esta información para que la descripción y los temas encajen con el negocio real.\n` : ""}
${employeeContext ? `\nCONTEXTO DEL NEGOCIO: ${employeeContext}\nSi reconoces a algún empleado de esta lista en la imagen (por su cargo, especialidad o descripción de estilo de trabajo), menciona su nombre exacto en el campo "employeeDetected". Si no puedes identificarlo con una señal visual razonable, deja "employeeDetected" en null — NUNCA inventes ni asumas un nombre sin fundamento.\n` : ""}
Ahora, compara lo que describiste en el PASO 1 con estas categorías. Identifica cuál encaja mejor SOLO si realmente encaja, y extrae el detalle concreto correspondiente para el campo "specificContext":

1. GYM / FUERZA (pesas, mancuernas, barra, máquinas): identifica el ejercicio concreto si es reconocible (press banca, sentadilla, remo, curl bíceps, peso muerto, zancadas, etc.), el grupo muscular que trabaja, y si la postura, el agarre o la carga aparente sugieren esfuerzo/intensidad alta.
2. CUERDAS / ENTRENAMIENTO FUNCIONAL (battle ropes, kettlebells, circuitos): identifica el tipo de movimiento (oleadas, slams, en cruz, lateral) y qué trabaja (core, hombros, cardio).
3. COCINA / NUTRICIÓN (ingredientes visibles: verduras, pimientos, proteína, batidos, bowls): identifica los ingredientes concretos que reconozcas y qué tipo de receta o preparación sugieren (ensalada, salteado, smoothie bowl, meal prep, etc.).
4. RUNNING / OUTDOOR CARDIO: identifica el entorno (parque, montaña, playa, ciudad) e indicios de intensidad SOLO si son visibles (ropa técnica, sudor, terreno, hora del día aparente).
5. OTRAS (outdoor genérico, lifestyle, producto, evento, o CUALQUIER contenido que no encaje claramente en 1-4): mantén el nivel de detalle habitual, pero añade siempre 1-2 detalles concretos que realmente veas en la imagen (color, objeto, gesto, entorno) en vez de una frase genérica. Usa esta categoría siempre que el contenido real no encaje con claridad en 1-4 — NUNCA fuerces una imagen dentro de una categoría 1-4 solo porque el nicho de la marca sea ese.

⚠️ IMPORTANTE — si el contenido de la imagen no tiene relación con el nicho de la marca (ej. mascotas, familia, viajes, contenido no relacionado), descríbelo tal cual es (ej. "una foto de un gato y un perro"), sin forzar ninguna relación con el nicho ni con las categorías 1-4. Usa la categoría 5 (OTRAS) para este caso.

⚠️ REGLA ANTI-INVENCIÓN — OBLIGATORIA: si no puedes identificar con claridad un dato concreto (qué ejercicio exacto es, cuántos km corrió, qué ingrediente exacto es, cuánto tiempo pasó), NUNCA lo inventes ni des una cifra exacta que no puedas ver. Usa lenguaje aproximado y honesto en su lugar (ej. "trabajando la parte superior del cuerpo con pesas" en vez de adivinar "press banca"; "una buena tirada" o "carrera larga" en vez de inventar "5km").

${isEmpresa
  ? `Esta cuenta es de tipo EMPRESA: enfoca "specificContext" hacia el producto o servicio concreto visible en la imagen (qué se ofrece, qué resuelve), en tercera persona, nunca como experiencia personal.`
  : `Esta cuenta es de tipo INFLUENCER: enfoca "specificContext" hacia el detalle personal y motivacional de lo que se ve (el esfuerzo, la sensación, el logro concreto), como si lo viviera la propia creadora en primera persona.`}
Si la imagen no tiene relación con el nicho (categoría 5, caso mascotas/familia/viajes/etc.), aplica este mismo enfoque (empresa/influencer) al hecho real que describiste, sin inventar una conexión con el nicho.

Además, clasifica el campo "momentType" — el TIPO de momento que captura la foto, no lo que contiene ni el nicho:
- "accion": la foto captura movimiento físico activo y evidente — deporte, ejercicio intenso, corriendo, saltando, bailando con energía. Solo es "accion" si hay dinamismo corporal claro e inequívoco.
- "intimo_personal": la foto captura un momento cotidiano, casual o de vida personal — en casa o entorno doméstico tomando café, desayunando, leyendo, en el sofá, mirando el móvil, cocinando tranquilamente, preparando el outfit, selfie informal frente al espejo, backstage, momento de descanso, rutina diaria, luz natural suave. Si la escena es doméstica o personal aunque el sujeto esté quieto y la foto esté bien encuadrada, es "intimo_personal". También es "intimo_personal", explícitamente:
  · Persona riendo o sonriendo en exteriores sin hacer deporte (parque, calle, terraza).
  · Selfie frente a espejo con teléfono visible.
  · Persona mostrando su outfit/ropa del día, posando de pie en casa o en exterior casual.
  · Momento de ocio relajado al aire libre (sentada en un parque, paseando sin actividad deportiva).
- "estatico_compuesto": la foto es claramente una composición preparada para cámara sin contexto personal ni doméstico — retrato de estudio con fondo neutro, foto de producto, paisaje sin personas, contenido evergreen de alta calidad visual sin historia personal detrás.

REGLA DE DESEMPATE (aplícala SIEMPRE que dudes entre categorías):
- Si hay UNA persona y NO hay equipamiento deportivo activo NI fondo de estudio/profesional, elige "intimo_personal" por defecto — incluso si la foto está bien encuadrada o iluminada.
- "Riendo", "sonriendo" o "posando con ropa" sin contexto deportivo intenso es SIEMPRE "intimo_personal", nunca "accion" ni "estatico_compuesto".
- Entre "intimo_personal" y "estatico_compuesto": elige "intimo_personal" si hay una persona en un contexto de vida cotidiana o doméstico. Elige "estatico_compuesto" solo si es claramente una foto de producto, estudio o paisaje sin contexto personal.

⚠️ CONTRAEJEMPLOS — para no sobrecorregir hacia "intimo_personal":
- Persona corriendo, saltando o levantando peso → "accion" (NUNCA "intimo_personal", aunque además esté sonriendo o el entorno sea informal — el movimiento físico manda sobre la expresión facial).
- Foto de producto sin ninguna persona → "estatico_compuesto".
- Grupo de personas en un evento (fiesta, conferencia, celebración) → "estatico_compuesto".
- Una mascota, un animal o una escena sin relación con el nicho → clasifica "momentType" según lo que realmente se ve (ej. una mascota jugando en casa es "intimo_personal"; una mascota posando quieta para una foto es "estatico_compuesto"), nunca fuerces "accion" solo porque el nicho de la marca sea deportivo.

Decide también el campo "recommendedPostType" según estos criterios, y hazlo coherente con el "momentType" que acabas de elegir (elige el que mejor encaje, no asumas un valor por defecto):
- REEL: corresponde a momentType "accion" — movimiento implícito, deporte, ejercicio, energía o dinamismo.
- STORY: corresponde a momentType "intimo_personal" — contenido casual, efímero, íntimo, backstage, un momento cotidiano, selfie informal, o algo que invite a preguntar/interactuar con la audiencia.
- FEED: corresponde a momentType "estatico_compuesto" — foto pulida, estática, bien compuesta — retrato, paisaje, producto o contenido evergreen de alta calidad visual.

PASO 3 — FORMATO DE RESPUESTA (OBLIGATORIO):
Responde ÚNICAMENTE con este JSON válido (sin markdown, sin texto extra, sin explicaciones antes ni después):
{
  "description": "descripción detallada de qué hay en la imagen en una oración",
  "emotion": "emoción principal que transmite (ej: confianza, alegría, profesionalismo, energía)",
  "context": "contexto visual (ej: interior de negocio, producto, persona, paisaje, evento)",
  "recommendedPostType": "<FEED|REEL|STORY>",
  "momentType": "<accion|intimo_personal|estatico_compuesto>",
  "suggestedThemes": ["tema relevante 1", "tema relevante 2", "tema relevante 3"],
  "specificContext": "1-2 frases con el detalle concreto y granular de la categoría detectada — es el campo más importante de tu respuesta, sin datos inventados",
  "employeeDetected": "nombre exacto del empleado si lo reconoces con certeza razonable, o null si no aplica"
}

EJEMPLO 1 (imagen relacionada con el nicho — nicho "fitness", foto de alguien haciendo sentadillas con barra en un gimnasio):
{"description": "Persona realizando una sentadilla con barra en un gimnasio", "emotion": "energía", "context": "gimnasio, entrenamiento de fuerza", "recommendedPostType": "REEL", "momentType": "accion", "suggestedThemes": ["fuerza", "entrenamiento de piernas", "constancia"], "specificContext": "Trabajando tren inferior con sentadilla, carga aparente media-alta.", "employeeDetected": null}

EJEMPLO 2 (imagen SIN relación con el nicho — nicho "fitness", foto de un gato y un perro en un sofá):
{"description": "Un gato y un perro descansando juntos sobre un sofá", "emotion": "cercanía", "context": "interior doméstico, mascotas", "recommendedPostType": "STORY", "momentType": "intimo_personal", "suggestedThemes": ["mascotas", "momento cotidiano", "vida diaria"], "specificContext": "Un gato y un perro compartiendo un momento tranquilo en casa, sin relación con entrenamiento o nutrición.", "employeeDetected": null}

El campo recommendedPostType debe ser exactamente uno de: "FEED", "REEL" o "STORY", elegido según los criterios de arriba — nunca copies literalmente el placeholder "<FEED|REEL|STORY>".
El campo momentType debe ser exactamente uno de: "accion", "intimo_personal" o "estatico_compuesto" — nunca copies literalmente el placeholder.
Los temas deben ser relevantes para el nicho: ${profile.niche}, salvo que la imagen no tenga relación con él (en ese caso, deben ser relevantes para lo que realmente aparece en la imagen).
Responde TODO en español.`;

    try {
      const result = (await binding.run(IMAGE_ANALYSIS_MODEL, {
        prompt,
        image: imageBytes,
        max_tokens: 1024,
        temperature: 0.1,
      })) as { response?: string } | null;

      const raw = result?.response ?? "";
      const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        console.error("[ImageAnalysisAgent] LLaVA respondió pero sin JSON parseable. Respuesta cruda:", raw?.slice(0, 500));
        return fallback;
      }

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
        momentType:
          parsed.momentType === "accion" ||
          parsed.momentType === "intimo_personal" ||
          parsed.momentType === "estatico_compuesto"
            ? parsed.momentType
            : fallback.momentType,
        employeeDetected:
          employeeContext && typeof parsed.employeeDetected === "string" && parsed.employeeDetected.trim()
            ? parsed.employeeDetected.trim()
            : null,
        degraded: false,
      };
    } catch (error) {
      console.error("[ImageAnalysisAgent] Excepción no manejada:", error);
      return fallback;
    }
  }
}
