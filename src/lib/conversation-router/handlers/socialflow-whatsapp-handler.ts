/**
 * conversation-router/handlers/socialflow-whatsapp-handler.ts
 *
 * Thin router adapter for SocialFlow (Socialcors) WhatsApp domain logic.
 * Calls generateSocialflowWhatsappReply() directly — no HTTP subrequest,
 * avoiding the self-referential fetch() back into this same worker/zone
 * that previously caused Cloudflare 522s.
 */
import { registerHandler } from "../index";
import type { ConversationHandler, RouteResult } from "../types";
import { generateSocialflowWhatsappReply } from "@/lib/socialflow/ai/whatsapp-reply";

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
    const reply = await generateSocialflowWhatsappReply({
      tenantId: route.tenantId,
      saasId,
      message: route.message,
    });

    return { handled: true, handler: HANDLER_ID, reply };
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
