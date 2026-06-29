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

export class ContentGeneratorAgent {
  async run(input: {
    profile: BrandProfile;
    strategyItem: { id: string; theme: string; angle: string; callToAction: string };
    keywordEngine: KeywordEngineOutput;
    trends: TrendInsights;
    openerIndex?: number;
  }): Promise<GeneratedPost> {
    const { profile, strategyItem, keywordEngine, trends } = input;
    // Rotate opener so every upload gets a different caption structure.
    // Falls back to time-based seed when no explicit index is given.
    const openerIndex = (input.openerIndex ?? Math.floor(Date.now() / 60_000)) % 10;

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
Cada párrafo, ejemplo, dato y metáfora debe ser específico de "${profile.niche}".
No uses "${profile.niche}" como simple etiqueta — es el corazón de todo el contenido.
${profile.voiceInstruction ? `\n⚠️ VOZ OBLIGATORIA: ${profile.voiceInstruction}\n` : ""}
Ángulo a desarrollar: ${strategyItem.angle}
Tipo de contenido: ${strategyItem.theme}
${extra ? `\n${extra}` : ""}
Identidad: ${profile.brandIdentity} · Tono: ${profile.toneOfVoice}.
CTA: ${cta}
${hooks ? `Hooks de referencia (adapta al tema): ${hooks}` : ""}
${keywords ? `Keywords a incluir naturalmente: ${keywords}` : ""}
${hashtagSeed ? `Hashtags de referencia para incluir: ${hashtagSeed}` : ""}

⚠️ APERTURA — REGLA IRROMPIBLE: NUNCA empieces con "Hola", "Chicas", ni presentándote ("Soy ${profile.brandIdentity}...").
Las 10 aperturas disponibles:
1. "¿Alguna vez has sentido que [situación relacionada con el tema]?"
2. "Seré honesta contigo: [verdad incómoda o revelación sobre el tema]."
3. "Esto me cambió la vida: [resultado o aprendizaje clave del tema]."
4. "Lo que nadie te cuenta sobre [tema del post]:"
5. "Hoy necesito contarte algo sobre [tema]."
6. "¿Lista para un cambio real en [tema]?"
7. "Semana difícil. Pero aquí estoy, y tengo algo importante que compartir."
8. "Años haciendo esto y por fin entendí: [lección sobre el tema]."
9. "La verdad sobre [tema]:"
10. "No siempre es fácil, pero [acción o actitud relacionada con el tema]."
⚠️ DEBES comenzar el post con la apertura número ${openerIndex + 1} de la lista anterior (adaptada al tema concreto del post).

Estructura obligatoria:
1. Apertura usando UNA de las 10 frases anteriores (adaptada al tema, sin "Hola")
2. Desarrollo en 2-3 párrafos donde YO (la influencer) hablo desde mi experiencia personal: qué hago, qué siento, qué aprendí, qué me funciona. Uso "yo", "mi", "me", "mis". NO escribo consejos genéricos dirigidos a la audiencia. Hablo de MI vida y MI experiencia relacionada con el tema de la imagen.
3. Cierre con el CTA

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
          text: profile.voiceInstruction
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
