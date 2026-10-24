import { SOCIALCORS_INTERNAL_CONTRACT_VERSION, type SocialFlowWhatsappReplyResponse } from "@/lib/capabilities/internal-api-types/socialflow";
import { generateSocialflowWhatsappReply } from "@/lib/socialflow/ai/whatsapp-reply";
import { authenticateInternalRequest, internalError, internalJson, isRecord, readNonEmptyString } from "@/lib/socialflow/internal-api/respond";

export const dynamic = "force-dynamic";

// Respuesta de SocialCors a un mensaje de WhatsApp que el router del holding
// (conversation-router) ha resuelto a un tenant de SocialCors.
export async function POST(request: Request) {
  const auth = authenticateInternalRequest(request);
  if (!auth.ok) return auth.response;
  const { requestId } = auth.caller;

  const body = await request.json().catch(() => null);
  const tenantId = isRecord(body) ? readNonEmptyString(body.tenantId) : null;
  const saasId = isRecord(body) ? readNonEmptyString(body.saasId) : null;
  const message = isRecord(body) ? readNonEmptyString(body.message) : null;
  if (!tenantId || !saasId || !message) {
    return internalError("INTERNAL_API_BAD_REQUEST", "tenantId, saasId and message are required", requestId, 400);
  }

  const base = { service: "socialflow" as const, runtime: "socialcors" as const, contractVersion: SOCIALCORS_INTERNAL_CONTRACT_VERSION, requestId };
  try {
    const reply = await generateSocialflowWhatsappReply({ tenantId, saasId, message });
    const response: SocialFlowWhatsappReplyResponse = { ...base, handled: true, reply, error: null };
    return internalJson(response);
  } catch (error) {
    const response: SocialFlowWhatsappReplyResponse = {
      ...base,
      handled: false,
      reply: null,
      error: error instanceof Error ? error.message : "SOCIALFLOW_WHATSAPP_FAILED",
    };
    return internalJson(response);
  }
}
