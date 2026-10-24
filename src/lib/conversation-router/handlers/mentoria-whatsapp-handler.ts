/**
 * conversation-router/handlers/mentoria-whatsapp-handler.ts
 *
 * Thin router adapter for Mentoria WhatsApp domain entrypoint.
 */
import { runMentoriaWhatsappEntry } from "@/lib/mentoria/whatsapp-entry";
import { registerHandler } from "../index";
import type { ConversationHandler, RouteResult } from "../types";

const HANDLER_ID = "mentoria";

const mentoriaWhatsappHandler: ConversationHandler = async (route): Promise<RouteResult> => {
  try {
    const saasId = route.metadata?.saasId as string;
    if (!saasId) {
      return {
        handled: false,
        handler: HANDLER_ID,
        reply: null,
        error: "MISSING_SAAS_ID",
      };
    }

    const result = await runMentoriaWhatsappEntry({
      tenantId: route.tenantId,
      saasId,
      phoneNumber: route.senderId,
      body: route.message,
      actorType: (route.metadata?.actorType as "PLATFORM_OWNER" | "SAAS_OWNER" | "EMPLOYEE" | "CUSTOMER" | null) ?? null,
      actorId: (route.metadata?.actorId as string | null) ?? null,
      metadata: route.metadata ?? null,
    });

    const reply = result.messagesToSend.map((m) => m.body).join("\n") || null;

    return {
      handled: result.handled,
      handler: HANDLER_ID,
      reply,
      intent: result.intent,
      error: result.error,
    };
  } catch (error) {
    return {
      handled: false,
      handler: HANDLER_ID,
      reply: null,
      error: error instanceof Error ? error.message : "MENTORIA_WHATSAPP_HANDLER_ERROR",
    };
  }
};

export function registerMentoriaWhatsappHandler(): void {
  registerHandler(HANDLER_ID, mentoriaWhatsappHandler);
}
