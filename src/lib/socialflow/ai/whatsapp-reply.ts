import { SocialFlowOrchestrator } from "./SocialFlowOrchestrator";
import { intelligenceModel } from "./models/anthropicModel";

type WhatsappReplyPayload = { reply: string };

export async function generateSocialflowWhatsappReply({
  tenantId,
  saasId,
  message,
}: {
  tenantId: string;
  saasId: string;
  message: string;
}): Promise<string> {
  const profile = await new SocialFlowOrchestrator().buildProfile({
    tenantId, saasId, niche: "", tone: "", frequencyPerWeek: 1, accountType: null,
  });

  const fallbackReply = `Gracias por escribir a ${profile.brandIdentity}. En breve te responderemos.`;

  const { data } = await intelligenceModel.generateStructured<WhatsappReplyPayload>(
    {
      tenantId, saasId,
      prompt: `Eres el asistente de WhatsApp de "${profile.brandIdentity}" (nicho: ${profile.niche}). Tono: ${profile.toneOfVoice}.
Responde en español, en 1-3 frases, directo y útil, a este mensaje de un cliente/lead por WhatsApp:
"${message}"`,
    },
    () => ({ reply: fallbackReply }),
  );

  return data.reply?.trim() || fallbackReply;
}
