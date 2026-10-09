/**
 * conversation-router/handlers/socialflow-whatsapp-handler.ts
 *
 * Thin router adapter for SocialFlow (Socialcors) WhatsApp domain logic.
 *
 * P6: la respuesta la genera SocialCors (POST /api/internal/socialflow/whatsapp/reply).
 * Va por el service binding SOCIALCORS_INTERNAL, que no pasa por la zona pública:
 * no repite el problema de los 522 del antiguo fetch() del Worker a su propio dominio.
 */
import { registerHandler } from "../index";
import type { ConversationHandler, RouteResult } from "../types";
import { postSocialFlowWhatsappReply } from "@/lib/capabilities/internal-api-clients/socialflow-control-plane";

const HANDLER_ID = "socialflow";

const socialflowWhatsappHandler: ConversationHandler = async (route): Promise<RouteResult> => {
  const saasId = route.metadata?.saasId as string | undefined;
  if (!saasId) {
    return { handled: false, handler: HANDLER_ID, reply: null, error: "MISSING_SAAS_ID" };
  }

  if (!route.tenantId || !route.message) {
    return { handled: false, handler: HANDLER_ID, reply: null, error: "MISSING_REQUIRED_FIELDS" };
  }

  try {
    const response = await postSocialFlowWhatsappReply({
      tenantId: route.tenantId,
      saasId,
      message: route.message,
    });

    if (!response.handled) {
      return { handled: false, handler: HANDLER_ID, reply: null, error: response.error ?? "SOCIALFLOW_WHATSAPP_FAILED" };
    }
    return { handled: true, handler: HANDLER_ID, reply: response.reply };
  } catch (error) {
    return {
      handled: false,
      handler: HANDLER_ID,
      reply: null,
      error: error instanceof Error ? error.message : "SOCIALFLOW_WHATSAPP_FAILED",
    };
  }
};

export function registerSocialflowWhatsappHandler(): void {
  registerHandler(HANDLER_ID, socialflowWhatsappHandler);
}
