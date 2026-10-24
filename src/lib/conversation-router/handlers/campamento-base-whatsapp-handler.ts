/**
 * conversation-router/handlers/campamento-base-whatsapp-handler.ts
 *
 * WhatsApp handler for Campamento Base - the central control plane.
 * Handles inbound WhatsApp messages for the core platform operations.
 *
 * This handler routes to the existing runWhatsappAutomation system
 * which provides comprehensive WhatsApp automation capabilities.
 */
import { runWhatsappAutomation } from "@/lib/whatsapp/automation";
import { registerHandler } from "../index";
import type { ConversationHandler, RouteResult } from "../types";

const HANDLER_ID = "campamento-base";

const campamentoBaseWhatsappHandler: ConversationHandler = async (route): Promise<RouteResult> => {
  try {
    // Extract saasId from metadata (should be provided by the channel layer)
    const saasId = route.metadata?.saasId as string;
    if (!saasId) {
      return {
        handled: false,
        handler: HANDLER_ID,
        reply: null,
        error: "Missing saasId in route metadata",
      };
    }

    // Route to the existing WhatsApp automation system
    const result = await runWhatsappAutomation({
      tenantId: route.tenantId,
      saasId,
      phoneNumber: route.senderId,
      body: route.message,
      metadata: route.metadata,
    });

    // Convert WhatsApp automation result to router format
    const reply = result.messagesToSend.map(m => m.body).join("\n") || null;
    
    return {
      handled: true,
      handler: HANDLER_ID,
      reply,
      intent: result.intents[0] ?? undefined,
    };
  } catch (error) {
    console.error("[campamento-base-whatsapp-handler] error", error);
    return {
      handled: false,
      handler: HANDLER_ID,
      reply: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Register the Campamento Base WhatsApp handler with the router.
 * Call this once at app startup or in the service endpoint initialization.
 * Idempotent: safe to call multiple times.
 */
export function registerCampamentoBaseWhatsappHandler(): void {
  registerHandler(HANDLER_ID, campamentoBaseWhatsappHandler);
}
