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
  }): Promise<GeneratedPost> {
    const { profile, strategyItem, keywordEngine, trends } = input;

    const extra = richProfileLines(profile);
    const keywords = keywordEngine.clusters.map((c) => c.cluster).filter(Boolean).join(", ");
    const hooks = trends.hookIdeas.filter(Boolean).slice(0, 3).join(" | ");
    const cta = profile.primaryCTA || `¿Cuál es tu mayor reto con ${profile.niche}? Cuéntanos abajo.`;

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

⚠️ APERTURA VARIADA — PROHIBIDO empezar con "Hola", una presentación, o "Soy ${profile.brandIdentity}".
Elige UN estilo de apertura según el ángulo emocional del contenido:
• Pregunta directa: "¿Cuántas veces has intentado...?" / "¿Te ha pasado que...?"
• Confesión personal: "Durante años creí que..." / "Voy a ser honesta contigo:"
• Dato o afirmación inesperada: "Nadie te dice que..." / "El error más común en ${profile.niche} es..."
• Imperativo: "Para. Respira. Ahora lee esto." / "Deja de hacer esto."
• Emoción en bruto: "Hoy fue un día difícil. Y también necesario."
• Entrada directa al tema: "Llevas semanas intentando ${strategyItem.angle} y no avanzas porque..."

Estructura obligatoria:
1. Apertura con el estilo elegido (sin presentarte, sin "Hola")
2. Desarrollo en 3-5 párrafos con información concreta y accionable sobre "${profile.niche}"
3. Cierre con el CTA

Máximo 15 hashtags relevantes sobre "${profile.niche}". Responde SOLO con el JSON solicitado.`;

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

¿Cuál es tu mayor obstáculo en ${profile.niche}? Cuéntanos en los comentarios.

${cta}`,
          callToAction: strategyItem.callToAction || cta,
        },
      ],
    };

    const { data } = await defaultLocalModel.generateStructured<GeneratedPost>({ prompt }, () => base);

    return data;
  }
}
