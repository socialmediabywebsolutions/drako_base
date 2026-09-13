import { intelligenceModel } from "@/lib/socialflow/ai/models/anthropicModel";
import { attachMeta } from "@/lib/socialflow/ai/models/localModel";
import type { ConversationalReplyInput, ConversationalReplyOutput } from "@/lib/socialflow/conversational/types";

// Antes, el perfil (tono, servicios del onboarding) y la Knowledge Base (documentos
// PDF/texto subidos por el cliente) eran dos bloques sueltos con el mismo peso
// implícito — el perfil "ganaba" solo porque aparecía primero en el prompt, y el
// contenido real de la KB quedaba como un bloque de texto débil al final. Esto
// reconstruye el system prompt como 4 niveles de prioridad explícitos, de mayor a
// menor, con el orden y el lenguaje del prompt reforzando esa jerarquía — un LLM no
// tiene "tiers" reales, así que la prioridad se implementa con orden + instrucción
// explícita, no con estructura de datos.
// Etiqueta legible del canal para la REGLA CRÍTICA DE CANAL — el resto del codebase
// usa estos mismos 3 valores de provider (ver PROVIDER_LABELS en conversation-inbox.tsx
// y el selector de canal del probador de operador). Cualquier provider no listado se
// muestra tal cual (nunca se inventa una etiqueta).
const CHANNEL_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK_PAGE: "Facebook",
  LINKEDIN: "LinkedIn",
};

function buildSystemPrompt(input: ConversationalReplyInput): string {
  const { profile, knowledge, knowledgeContext, provider, threadType } = input;
  const brandName = profile.brandName || "la marca";
  const bannedWords = profile.bannedWords?.length ? profile.bannedWords.join(", ") : "ninguna";
  const forbiddenTopics = profile.forbiddenTopics?.length ? profile.forbiddenTopics.join(", ") : "ninguno";
  const services = profile.services?.length ? profile.services.join(", ") : "";
  const offers = profile.offers?.length ? profile.offers.join(", ") : "";
  const offerLine = [services, offers].filter(Boolean).join("; ");
  const toneLine = [profile.toneOfVoice, profile.personality].filter(Boolean).join(" ");
  const competitorNames = knowledge?.competitors?.length
    ? knowledge.competitors.map((c) => c.name).filter(Boolean).join(", ")
    : "";
  const channelLabel = CHANNEL_LABELS[provider] ?? provider;
  const threadTypeLabel = threadType === "COMMENT" ? "COMENTARIO (respuesta pública)" : "DM (mensaje directo privado)";

  const sections: string[] = [`Eres el asistente de respuesta social de ${brandName}.`];

  // 1. REGLAS DURAS — máxima prioridad, nunca se ignoran. La derivación a humano que
  // puedan traer los documentos de conocimiento (sección 2) se eleva explícitamente a
  // este nivel: no se parsea el texto del documento aquí (sería frágil), se le indica
  // al modelo que trate cualquier instrucción de derivación que encuentre ahí como una
  // regla dura, sin importar en qué sección del prompt aparezca físicamente. Las
  // reglas de voz (BUG 1: la IA hablaba DE la influencer en tercera persona) y de
  // canal (BUG 2: mezclaba contexto de DM/comentario) van aquí también — son tan
  // básicas para que la respuesta suene real como la derivación a humano.
  sections.push(
    [
      "=== 1. REGLAS DURAS (máxima prioridad — nunca las ignores) ===",
      "Cualquier instrucción sobre cuándo derivar la conversación a un humano que aparezca dentro de los DOCUMENTOS DE CONOCIMIENTO de la sección 2 tiene prioridad absoluta sobre el resto de este prompt — si un documento dice que un tema debe derivarse a una persona, derívalo siempre, aunque el resto del contexto sugiera responder.",
      `REGLA CRÍTICA DE VOZ: Habla SIEMPRE en primera persona como si fueras ${brandName}. NUNCA menciones tu propio nombre en tercera persona. NUNCA digas '${brandName} te ayudará' o '${brandName} te responderá' — di siempre 'yo te ayudaré', 'con gusto te ayudo', 'estaré encantada de ayudarte'. Si derivas al humano, di 'te respondo yo personalmente' o 'lo gestiono yo directamente', nunca '${brandName} lo gestionará'.`,
      `REGLA CRÍTICA DE CANAL: El canal actual es ${channelLabel} y el tipo es ${threadTypeLabel}. Adapta tu respuesta al contexto: si es DM, respuesta privada, directa, personal — NUNCA digas 'cuéntame en los comentarios' ni 'escríbeme por DM' (ya estás en DM); si es COMENTARIO, respuesta pública, más breve, puedes invitar a continuar por DM si el tema es privado o comercial.`,
      toneLine ? `Tono y personalidad: ${toneLine}.` : "",
      `Palabras prohibidas: ${bannedWords}.`,
      `Temas prohibidos: ${forbiddenTopics}.`,
    ]
      .filter(Boolean)
      .join(" "),
  );

  // 2. INFORMACIÓN DE NEGOCIO — documentos reales de la Knowledge Base (PDF/texto
  // subidos por el cliente: servicios, ofertas, precios, FAQs). Segunda prioridad,
  // por encima del contexto de marca genérico del perfil.
  if (knowledgeContext) {
    sections.push(
      [
        "=== 2. INFORMACIÓN DE NEGOCIO — DOCUMENTOS DE CONOCIMIENTO (segunda prioridad) ===",
        knowledgeContext,
        "Si esta información cubre el tema preguntado (servicios, ofertas, precios, FAQs), ÚSALA SIEMPRE tal cual está escrita — no la contradigas ni la completes con datos inventados.",
      ].join("\n"),
    );
  }

  // 3. CONTEXTO DE MARCA — perfil de onboarding, tercera prioridad. Solo rellena
  // huecos que la Knowledge Base no cubra.
  const brandContext = [
    "=== 3. CONTEXTO DE MARCA (tercera prioridad — usa esto cuando los documentos de arriba no cubran el tema) ===",
    profile.niche ? `Nicho: ${profile.niche}.` : "",
    profile.audienceDescription ? `Audiencia: ${profile.audienceDescription}.` : "",
    profile.mission ? `Misión: ${profile.mission}.` : "",
    profile.valueProposition ? `Propuesta de valor: ${profile.valueProposition}.` : "",
    offerLine ? `Servicios y ofertas del perfil (solo si los documentos de conocimiento no dan un dato más específico): ${offerLine}.` : "",
    profile.primaryCTA ? `CTA principal: ${profile.primaryCTA}.` : "",
    competitorNames ? `Competidores relevantes: ${competitorNames}.` : "",
  ].filter(Boolean);
  if (brandContext.length > 1) sections.push(brandContext.join(" "));

  // 4. CONOCIMIENTO GENERAL DE IA — último recurso, solo si nada de lo anterior cubre
  // el tema, y nunca presentado como dato específico del cliente.
  sections.push(
    [
      "=== 4. CONOCIMIENTO GENERAL DE IA (última prioridad) ===",
      "Usa tu conocimiento general SOLO si ninguna de las fuentes anteriores (reglas duras, documentos de conocimiento, contexto de marca) cubre el tema preguntado. Si lo haces, nunca lo presentes como información específica o exclusiva de este cliente.",
    ].join(" "),
  );

  sections.push(
    `REGLA CRÍTICA: Si los documentos de conocimiento contienen información sobre el tema preguntado, úsala SIEMPRE. Nunca inventes URLs, páginas web, precios o datos que no estén en los documentos. Si no tienes información concreta sobre algo, di que ${brandName} lo responderá personalmente.`,
  );

  sections.push("Responde de forma concisa, en el mismo idioma del mensaje entrante, sin inventar datos.");
  sections.push("Responde ÚNICAMENTE con JSON válido con la clave 'suggestedReply'. Sin markdown ni comentarios.");

  return sections.filter(Boolean).join("\n\n");
}

function buildPrompt(input: ConversationalReplyInput): string {
  const typeLabel = input.threadType === "COMMENT" ? "comentario" : "mensaje directo";
  const senderLine = input.senderName ? ` de ${input.senderName}` : "";
  return `${typeLabel}${senderLine}: "${input.incomingMessage}"`;
}

export async function generateConversationalReply(
  input: ConversationalReplyInput,
): Promise<ConversationalReplyOutput> {
  const system = buildSystemPrompt(input);
  const prompt = buildPrompt(input);

  const result = await intelligenceModel.generateStructured(
    { prompt, system, tenantId: input.tenantId, saasId: input.saasId },
    () => ({ suggestedReply: "" }),
  );

  const suggestedReply =
    typeof result.data?.suggestedReply === "string" && result.data.suggestedReply.trim()
      ? result.data.suggestedReply.trim()
      : "Gracias por tu mensaje. Te responderemos pronto.";

  const aiMetadata = attachMeta(
    {
      generatedAt: new Date().toISOString(),
      promptPreview: prompt.slice(0, 120),
      threadType: input.threadType,
    },
    (result.data as Record<string, unknown>)._meta as Record<string, unknown> ?? {},
  ) as Record<string, unknown>;

  return { suggestedReply, aiMetadata };
}
