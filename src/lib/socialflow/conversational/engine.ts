import { intelligenceModel } from "@/lib/socialflow/ai/models/anthropicModel";
import { attachMeta } from "@/lib/socialflow/ai/models/localModel";
import type { ConversationalReplyInput, ConversationalReplyOutput } from "@/lib/socialflow/conversational/types";

function buildSystemPrompt(input: ConversationalReplyInput): string {
  const { profile } = input;
  const bannedWords = profile.bannedWords?.length ? profile.bannedWords.join(", ") : "ninguna";
  const forbiddenTopics = profile.forbiddenTopics?.length ? profile.forbiddenTopics.join(", ") : "ninguno";
  const services = profile.services?.length ? profile.services.join(", ") : "";
  const offers = profile.offers?.length ? profile.offers.join(", ") : "";
  const offerLine = [services, offers].filter(Boolean).join("; ");

  return [
    `Eres el asistente de respuesta social de ${profile.brandName || "la marca"}.`,
    profile.toneOfVoice ? `Tono: ${profile.toneOfVoice}.` : "",
    profile.audienceDescription ? `Audiencia: ${profile.audienceDescription}.` : "",
    offerLine ? `Servicios y ofertas: ${offerLine}.` : "",
    profile.primaryCTA ? `CTA principal: ${profile.primaryCTA}.` : "",
    `Palabras prohibidas: ${bannedWords}.`,
    `Temas prohibidos: ${forbiddenTopics}.`,
    "Responde de forma concisa, en el mismo idioma del mensaje entrante, sin inventar datos.",
    "Responde ÚNICAMENTE con JSON válido con la clave 'suggestedReply'. Sin markdown ni comentarios.",
  ]
    .filter(Boolean)
    .join(" ");
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
    { prompt, system },
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
