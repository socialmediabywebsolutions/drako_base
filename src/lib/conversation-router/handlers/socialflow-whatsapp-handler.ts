/**
 * conversation-router/handlers/socialflow-whatsapp-handler.ts
 *
 * NOT_IMPLEMENTED — stub handler for SocialFlow SaaS.
 *
 * This handler is a placeholder. It will never be dispatched by the router
 * in the current routing scheme (all WhatsApp routes to campamento-base).
 *
 * To activate: wire this handler to real SocialFlow domain logic
 * (src/lib/socialflow/client.ts, etc.) and implement a saasId → platform
 * type resolver in the router.
 */
import { registerHandler } from "../index";
import type { ConversationHandler, RouteResult } from "../types";

const HANDLER_ID = "socialflow";

const socialflowWhatsappHandler: ConversationHandler = async (): Promise<RouteResult> => {
  return {
    handled: false,
    handler: HANDLER_ID,
    reply: null,
    error: "NOT_IMPLEMENTED",
  };
};

/**
 * Register the SocialFlow WhatsApp stub with the router.
 * The handler will return NOT_IMPLEMENTED for all messages until
 * real SocialFlow domain logic is connected.
 */
export function registerSocialflowWhatsappHandler(): void {
  registerHandler(HANDLER_ID, socialflowWhatsappHandler);
}
