import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile, GeneratedPost, KeywordEngineOutput } from "../types";
import type { TrendInsights } from "./TrendAgent";

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

export type OpenerCategory = "gym" | "cocina" | "outdoor" | "lifestyle";

// Openers grouped by image category so the caption's first line actually matches
// what's in the photo, instead of one generic list shared by every kind of image.
const OPENERS_BY_CATEGORY: Record<OpenerCategory, string[]> = {
  gym: [
    "Otra sesión terminada: [sensación o logro concreto de hoy].",
    "Esto me costó admitirlo: [verdad incómoda sobre entrenar].",
    "Hoy el cuerpo pedía parar. No paré. [resultado o lección].",
    "Lo que nadie te cuenta antes de tomarte en serio el entrenamiento:",
    "Años entrenando y por fin entendí: [lección clave].",
  ],
  cocina: [
    "Esta receta me salvó una semana entera de [problema real].",
    "Seré honesta: [verdad incómoda sobre comer bien].",
    "Lo que aprendí cocinando esto para mí misma:",
    "Años buscando esto y por fin lo encontré: [resultado].",
    "La verdad sobre [tema de nutrición o comida]:",
  ],
  outdoor: [
    "Salir hoy casi no pasaba. Me alegra que sí.",
    "Esto me recordó por qué hago esto: [sensación o logro].",
    "Lo que nadie te dice sobre moverte al aire libre:",
    "Cambié la rutina de siempre por esto, y funcionó.",
    "¿Alguna vez sentiste que necesitabas salir de la rutina?",
  ],
  lifestyle: [
    "¿Alguna vez has sentido que [situación relacionada con el tema]?",
    "Hoy necesito contarte algo sobre [tema].",
    "La verdad sobre [tema]:",
    "Esto me cambió la manera de ver [tema].",
    "Lo que nadie te cuenta sobre [tema]:",
  ],
};

export class ContentGeneratorAgent {
  async run(input: {
    profile: BrandProfile;
    strategyItem: { id: string; theme: string; angle: string; callToAction: string };
    keywordEngine: KeywordEngineOutput;
    trends: TrendInsights;
    openerIndex?: number;
    openerCategory?: OpenerCategory;
    specificContext?: string;
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
    const cta = profile.primaryCTA || `¿Tú también lo sientes así? Cuéntame en los comentarios 👇`;

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
${input.specificContext ? `\n⚠️ DETALLE VISUAL CONCRETO — PRIORIDAD MÁXIMA: La imagen muestra exactamente esto: "${input.specificContext}". DEBES anclar la apertura y el cuerpo del post en este detalle real y concreto (el ejercicio, los ingredientes, el movimiento o el entorno específicos) en vez de frases genéricas de plantilla como "entrenando duro hoy" o "otro día más cuidándome". Si el detalle no incluye una cifra exacta (km, tiempo, peso), NO inventes una — usa el mismo nivel de aproximación que el detalle proporcionado.\n` : ""}${extra ? `\n${extra}` : ""}
Identidad: ${profile.brandIdentity} · Tono: ${profile.toneOfVoice}.
${(profile.ageRange || profile.gender) ? `Perfil del creador: ${[profile.ageRange ? `rango de edad ${profile.ageRange}` : "", profile.gender ? `género ${profile.gender}` : ""].filter(Boolean).join(", ")} — úsalo solo para calibrar referencias, ejemplos y estilo de voz; NUNCA lo menciones explícitamente en el post.` : ""}
CTA: ${cta}
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
3. Cierre con el CTA en una línea

Genera entre 10 y 15 hashtags relevantes: mezcla hashtags de nicho específico (fitness, nutrición, bienestar), hashtags de comunidad hispanohablante, y 2-3 hashtags virales del momento. Formato: #hashtag1 #hashtag2 ... IMPORTANTE: genera exactamente entre 10 y 15 hashtags. Nunca menos de 10.
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
          text: isEmpresa
? `${profile.brandIdentity} tiene la solución para quienes trabajan en ${profile.niche}.

${strategyItem.angle}.

Uno de los retos más frecuentes en ${profile.niche} es ${fallbackPain}. En ${profile.brandIdentity} lo sabemos bien — por eso ayudamos a conseguir ${fallbackDesire} con una estrategia clara.

Lo que ofrece ${profile.brandIdentity} en ${profile.niche}:

→ Un diagnóstico claro de tu punto de partida.
→ El ángulo correcto: ${strategyItem.angle}.
→ Seguimiento y ajuste constante de resultados.

¿Cuál es tu mayor obstáculo en ${profile.niche}? Cuéntanoslo en los comentarios.

${cta}`
: profile.voiceInstruction
? `Si te cuesta mantener la constancia en ${profile.niche}, esto es para ti.

${strategyItem.angle}.

Sé que uno de los mayores retos en ${profile.niche} es ${fallbackPain}. Yo también lo viví — y lo que marcó la diferencia fue tener una estrategia clara para conseguir ${fallbackDesire}.

Lo que a mí me ha funcionado en ${profile.niche}:

→ Entender primero mi propio contexto y punto de partida.
→ Aplicar el ángulo correcto: ${strategyItem.angle}.
→ Medir el impacto y ajustar cada semana.

¿Cuál es tu mayor obstáculo en ${profile.niche}? Cuéntame en los comentarios.

${cta}`
: `Si trabajas en ${profile.niche}, esto es para ti.

${strategyItem.angle}.

Uno de los retos más frecuentes en ${profile.niche} es ${fallbackPain}. La mayoría lo enfrenta sin una estrategia clara — y por eso no consigue ${fallbackDesire}.

Aquí va lo que realmente funciona en ${profile.niche}:

→ Entiende primero el contexto específico de tu situación.
→ Aplica el ángulo correcto: ${strategyItem.angle}.
→ Mide el impacto y ajusta cada semana.

¿Cuál es tu mayor obstáculo en ${profile.niche}? Cuéntame en los comentarios.

${cta}`,
          callToAction: strategyItem.callToAction || cta,
        },
      ],
    };

    const { data } = await defaultLocalModel.generateStructured<GeneratedPost>({ prompt }, () => base);

    return data;
  }
}
