import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile, GeneratedPost, KeywordEngineOutput } from "../types";
import type { TrendInsights } from "./TrendAgent";
import { OPENERS_BY_CATEGORY, type OpenerCategory } from "../openers/pickOpenerCategory";
import { nicheDefaultPostType } from "./ImageAnalysisAgent";
import { resolveObjectiveCta } from "../utils/ctaUtils";

// Fallback determinista (sin llamar a Mistral) cuando el binding de IA no está
// disponible — prioriza momentType (clasificación estructurada del modelo de visión,
// escala a cualquier nicho), luego la sugerencia de formato de LLaVA si es REEL/STORY,
// y solo usa el nicho como último desempate cuando no hay ninguna señal útil.
function resolveFallbackPostType(
  niche: string,
  llavaSuggestion?: "FEED" | "REEL" | "STORY",
  momentType?: "accion" | "intimo_personal" | "estatico_compuesto",
): "FEED" | "REEL" | "STORY" {
  if (momentType === "intimo_personal") return "STORY";
  if (momentType === "accion") return "REEL";
  if (momentType === "estatico_compuesto") return "FEED";
  if (llavaSuggestion === "REEL" || llavaSuggestion === "STORY") return llavaSuggestion;
  return nicheDefaultPostType(niche);
}

// Only include profile lines that carry information beyond the niche placeholder.
function richProfileLines(profile: BrandProfile): string {
  const lines: string[] = [];
  if (profile.audience && profile.audience !== `${profile.niche} buyers`) lines.push(`Audiencia: ${profile.audience}.`);
  if (profile.buyerPersona && profile.buyerPersona !== `${profile.niche} operator`) lines.push(`Buyer persona: ${profile.buyerPersona}.`);
  const pains = profile.painPoints.filter(p => p && p !== profile.niche);
  if (pains.length) lines.push(`Puntos de dolor reales: ${pains.join(", ")}.`);
  const desires = profile.desires.filter(d => d && d !== "growth");
  if (desires.length) lines.push(`Deseos del cliente: ${desires.join(", ")}.`);
  const services = profile.services.filter(Boolean);
  if (services.length) lines.push(`Servicios: ${services.join(", ")}.`);
  const offers = profile.offers.filter(Boolean);
  if (offers.length) lines.push(`Ofertas: ${offers.join(", ")}.`);
  const diffs = profile.differentiators.filter(Boolean);
  if (diffs.length) lines.push(`Diferenciadores: ${diffs.join(", ")}.`);
  const secondaryCTAs = profile.secondaryCTAs.filter(Boolean);
  if (secondaryCTAs.length) lines.push(`CTAs secundarios: ${secondaryCTAs.join(", ")}.`);
  const signals = profile.marketSignals.filter(Boolean);
  if (signals.length) lines.push(`Señales de mercado: ${signals.join(", ")}.`);
  const forbidden = profile.forbiddenTopics.filter(Boolean);
  if (forbidden.length) lines.push(`Temas prohibidos: ${forbidden.join(", ")}.`);
  const ctx = profile.longDescription.replace(`${profile.niche} content pipeline`, "").trim();
  if (ctx) lines.push(`Contexto de marca: ${ctx}`);
  return lines.join("\n");
}

export type { OpenerCategory };

export class ContentGeneratorAgent {
  async run(input: {
    profile: BrandProfile;
    strategyItem: { id: string; theme: string; angle: string; callToAction: string };
    keywordEngine: KeywordEngineOutput;
    trends: TrendInsights;
    openerIndex?: number;
    openerCategory?: OpenerCategory;
    specificContext?: string;
    llavaSuggestedFormat?: "FEED" | "REEL" | "STORY";
    momentType?: "accion" | "intimo_personal" | "estatico_compuesto";
    employeeDetected?: string | null;
  }): Promise<GeneratedPost> {
    const { profile, strategyItem, keywordEngine, trends } = input;
    const isEmpresa = profile.accountType === "empresa";
    const openers = OPENERS_BY_CATEGORY[input.openerCategory ?? "lifestyle"];
    // Rotate opener so every upload gets a different caption structure.
    // Falls back to time-based seed when no explicit index is given.
    const openerIndex = (input.openerIndex ?? Math.floor(Date.now() / 60_000)) % openers.length;
    const openerList = openers.map((o, i) => `${i + 1}. "${o}"`).join("\n");

    const extra = richProfileLines(profile);
    const keywords = keywordEngine.clusters.map((c) => c.cluster).filter(Boolean).join(", ");
    const hooks = trends.hookIdeas.filter(Boolean).slice(0, 3).join(" | ");
    // Cuando hay un objetivo configurado, OptimizationAgent añade el CTA real DESPUÉS
    // de optimizar el texto (protegido de reescritura por la IA, ver ctaUtils.ts y su
    // uso en OptimizationAgent.ts — es el último paso real del pipeline Post/Reel/
    // Historia, ContentGeneratorAgent NO lo es). Este borrador no debe llevar ningún CTA
    // propio en ese caso, o el caption final terminaría con dos. Sin objetivo,
    // comportamiento idéntico a siempre.
    const objectiveCta = resolveObjectiveCta(profile.clientObjective, profile.channelHandle);
    const cta = objectiveCta ? null : profile.primaryCTA || `¿Tú también lo sientes así? Cuéntame en los comentarios 👇`;
    const ctaSuffix = cta ? `\n\n${cta}` : "";

    const fitnessNicheKeys = ['fitness', 'nutrici', 'bienestar', 'salud', 'entrenamiento', 'gym', 'yoga', 'pilates', 'deporte', 'fit'];
    const isFitnessNiche = fitnessNicheKeys.some(k => profile.niche.toLowerCase().includes(k));
    const hashtagPool = [
      ...(profile.baseHashtags ?? []),
      ...(profile.priorityHashtags ?? []),
      ...(keywordEngine.campaignHashtags ?? []),
      ...(isFitnessNiche ? ['#FitnessParaMujeres', '#VidaFit', '#SaludYBienestar', '#MujerActiva', '#EntrenamientoFemenino', '#NutricionFit', '#HabitosSaludables', '#FitnessMotivacion', '#CuerpySano', '#BienestarFemenino', '#FitnessLatina', '#MindsetFit'] : []),
    ];
    const hashtagSeed = Array.from(new Set(hashtagPool)).slice(0, 15).join(' ');

    const prompt = `Escribe un post de redes sociales EN ESPAÑOL sobre el tema: "${profile.niche}".

⚠️ REGLA ABSOLUTA: El post trata EXCLUSIVAMENTE sobre "${profile.niche}".
Cada línea, ejemplo, dato y metáfora debe ser específico de "${profile.niche}".
No uses "${profile.niche}" como simple etiqueta — es el corazón de todo el contenido.

${isEmpresa
  ? `⚠️ VOZ — REGLA IRROMPIBLE: Escribe SIEMPRE en tercera persona hablando de "${profile.brandIdentity}" como marca/entidad. NUNCA uses "yo", "mi", "me" ni "mis". Ejemplos: "${profile.brandIdentity} presenta...", "En ${profile.brandIdentity} encontrarás...", "Nuestro equipo...".`
  : `⚠️ VOZ — REGLA IRROMPIBLE: Escribe SIEMPRE en primera persona singular (yo, mi, me, mis). Nunca hables de "${profile.brandIdentity}" en tercera persona ni como si fuera una empresa.`}
${profile.voiceInstruction ? `${profile.voiceInstruction}\n` : ""}
Ángulo a desarrollar: ${strategyItem.angle}
Tipo de contenido: ${strategyItem.theme}
${input.specificContext ? `\n⚠️ DETALLE VISUAL CONCRETO — PRIORIDAD MÁXIMA: La imagen muestra exactamente esto: "${input.specificContext}". DEBES anclar la apertura y el cuerpo del post en este detalle real y concreto (el ejercicio, los ingredientes, el movimiento o el entorno específicos) en vez de frases genéricas de plantilla como "entrenando duro hoy" o "otro día más cuidándome". Si el detalle no incluye una cifra exacta (km, tiempo, peso), NO inventes una — usa el mismo nivel de aproximación que el detalle proporcionado.\n` : ""}${input.employeeDetected ? `\n⚠️ EMPLEADO RECONOCIDO — PRIORIDAD ALTA: La imagen muestra a ${input.employeeDetected}. El caption DEBE mencionar a ${input.employeeDetected} por su nombre propio (ej. "${input.employeeDetected} creando unas mechas increíbles" en vez de una referencia genérica como "nuestro equipo" o "nuestra estilista").\n` : ""}${extra ? `\n${extra}` : ""}
Identidad: ${profile.brandIdentity} · Tono: ${profile.toneOfVoice}.
${(profile.ageRange || profile.gender) ? `Perfil del creador: ${[profile.ageRange ? `rango de edad ${profile.ageRange}` : "", profile.gender ? `género ${profile.gender}` : ""].filter(Boolean).join(", ")} — úsalo solo para calibrar referencias, ejemplos y estilo de voz; NUNCA lo menciones explícitamente en el post.` : ""}
${cta ? `CTA: ${cta}` : ""}
${hooks ? `Hooks de referencia (adapta al tema): ${hooks}` : ""}
${keywords ? `Keywords a incluir naturalmente: ${keywords}` : ""}
${hashtagSeed ? `Hashtags de referencia para incluir: ${hashtagSeed}` : ""}

⚠️ APERTURA — REGLA IRROMPIBLE: NUNCA empieces con "Hola", "Chicas", "A veces", ni presentándote ("Soy ${profile.brandIdentity}...").
Aperturas disponibles para este tipo de imagen:
${openerList}
⚠️ DEBES comenzar el post con la apertura número ${openerIndex + 1} de la lista anterior (adaptada al tema concreto del post).

⚠️ LONGITUD — REGLA IRROMPIBLE: El post completo debe tener MÁXIMO 3-4 líneas cortas e impactantes. Nada de párrafos largos. Cada línea debe aportar por sí sola.

Estructura obligatoria:
1. Línea de apertura usando UNA de las frases anteriores (adaptada al tema, sin "Hola", sin "A veces")
2. ${isEmpresa
  ? `1-2 líneas hablando de "${profile.brandIdentity}" en tercera persona: qué ofrece, qué resuelve, qué la diferencia. NO uses "yo", "mi", "me" ni "mis". Habla de la marca o del equipo, nunca en primera persona.`
  : `1-2 líneas donde YO (la influencer) hablo desde mi experiencia personal: qué hago, qué siento, qué aprendí. Uso "yo", "mi", "me", "mis". NO escribo consejos genéricos dirigidos a la audiencia. Hablo de MI vida y MI experiencia relacionada con el tema de la imagen.`}
3. ${cta ? "Cierre con el CTA en una línea" : "Cierre natural del pensamiento — NO añadas ningún call-to-action ni invites a seguir/comentar/guardar, el CTA se añade aparte por separado."}

Genera entre 10 y 15 hashtags relevantes: mezcla hashtags de nicho específico (fitness, nutrición, bienestar), hashtags de comunidad hispanohablante, y 2-3 hashtags virales del momento. Formato: #hashtag1 #hashtag2 ... IMPORTANTE: genera exactamente entre 10 y 15 hashtags. Nunca menos de 10.

Además, decide el formato final de publicación ("recommendedPostType") usando TODA esta información — tú tienes la decisión final, no una sola señal:
- Detalle visual real de la imagen: "${input.specificContext ?? "sin detalle visual disponible"}"
- Clasificación del tipo de momento (señal estructurada del modelo de visión): "${input.momentType ?? "sin clasificar"}"
- Sugerencia preliminar de formato del mismo modelo de visión (débil, puede estar equivocada — confírmala o descártala si el resto de la información indica otra cosa): "${input.llavaSuggestedFormat ?? "sin sugerencia"}"
- Nicho del cliente: "${profile.niche}"

Criterios:
- REEL: movimiento, acción, deporte, ejercicio, energía, dinamismo.
- STORY: momento personal del día a día, rutina íntima, preparación antes del entreno, descanso, café matutino, skincare, organización personal, backstage, selfie informal, contenido que dura 24h y no necesita ser perfecto — todo lo que NO es ejercicio en acción ni foto pulida.
- FEED: foto pulida, estática, bien compuesta — retrato, paisaje, producto, evergreen.

Regla de prioridad: si la clasificación del tipo de momento es "intimo_personal", clasifica como STORY; si es "accion", clasifica como REEL; si es "estatico_compuesto", clasifica como FEED — esta señal tiene prioridad sobre el resto, salvo que el nicho o el contexto de marca den una razón clara y explícita para contradecirla.

El campo recommendedPostType debe ser exactamente uno de: "FEED", "REEL" o "STORY".
Responde SOLO con el JSON solicitado.`;

    const fallbackHook = trends.hookIdeas[0] ?? `Lo que nadie te dice sobre ${profile.niche}...`;
    const fallbackPain = profile.painPoints.find(p => p && p !== profile.niche)
      ?? `los desafíos habituales del sector`;
    const fallbackDesire = profile.desires.find(d => d && d !== "growth")
      ?? `mejores resultados`;

    const base: GeneratedPost = {
      id: `gen_${strategyItem.id}`,
      strategyItemId: strategyItem.id,
      variants: [
        {
          id: `gen_${strategyItem.id}_v1`,
          hook: fallbackHook,
          recommendedPostType: resolveFallbackPostType(profile.niche, input.llavaSuggestedFormat, input.momentType),
          text: isEmpresa
? `${profile.brandIdentity} tiene la solución para quienes trabajan en ${profile.niche}.

${strategyItem.angle}.

Uno de los retos más frecuentes en ${profile.niche} es ${fallbackPain}. En ${profile.brandIdentity} lo sabemos bien — por eso ayudamos a conseguir ${fallbackDesire} con una estrategia clara.

Lo que ofrece ${profile.brandIdentity} en ${profile.niche}:

→ Un diagnóstico claro de tu punto de partida.
→ El ángulo correcto: ${strategyItem.angle}.
→ Seguimiento y ajuste constante de resultados.

¿Cuál es tu mayor obstáculo en ${profile.niche}? Cuéntanoslo en los comentarios.${ctaSuffix}`
: profile.voiceInstruction
? `Si te cuesta mantener la constancia en ${profile.niche}, esto es para ti.

${strategyItem.angle}.

Sé que uno de los mayores retos en ${profile.niche} es ${fallbackPain}. Yo también lo viví — y lo que marcó la diferencia fue tener una estrategia clara para conseguir ${fallbackDesire}.

Lo que a mí me ha funcionado en ${profile.niche}:

→ Entender primero mi propio contexto y punto de partida.
→ Aplicar el ángulo correcto: ${strategyItem.angle}.
→ Medir el impacto y ajustar cada semana.

¿Cuál es tu mayor obstáculo en ${profile.niche}? Cuéntame en los comentarios.${ctaSuffix}`
: `Si trabajas en ${profile.niche}, esto es para ti.

${strategyItem.angle}.

Uno de los retos más frecuentes en ${profile.niche} es ${fallbackPain}. La mayoría lo enfrenta sin una estrategia clara — y por eso no consigue ${fallbackDesire}.

Aquí va lo que realmente funciona en ${profile.niche}:

→ Entiende primero el contexto específico de tu situación.
→ Aplica el ángulo correcto: ${strategyItem.angle}.
→ Mide el impacto y ajusta cada semana.

¿Cuál es tu mayor obstáculo en ${profile.niche}? Cuéntame en los comentarios.${ctaSuffix}`,
          // objectiveCta como último fallback — cta puede ser null aquí precisamente
          // cuando hay objetivo configurado (ver arriba), así este campo informativo
          // sigue reflejando qué CTA se está usando de verdad.
          callToAction: strategyItem.callToAction || cta || objectiveCta || "",
        },
      ],
    };

    const { data } = await defaultLocalModel.generateStructured<GeneratedPost>({ prompt }, () => base);

    return data;
  }
}
