/**
 * conversation-router/campamento-base-handler.ts
 *
 * First domain handler: Campamento Base operator control plane.
 *
 */
import { runWhatsappAutomation } from "@/lib/whatsapp/automation";
import { registerHandler } from "./index";
import type { ConversationHandler, RouteResult } from "./types";

const HANDLER_ID = "campamento-base";

const campamentoBaseHandler: ConversationHandler = async (route): Promise<RouteResult> => {
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
    console.error("[campamento-base-handler] error", error);
    return {
      handled: false,
      handler: HANDLER_ID,
      reply: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Register the Campamento Base handler with the router.
 * Call this once at app startup or in the service endpoint initialization.
 * Idempotent: safe to call multiple times.
 */
export function registerCampamentoBaseHandler(): void {
  registerHandler(HANDLER_ID, campamentoBaseHandler);
}
