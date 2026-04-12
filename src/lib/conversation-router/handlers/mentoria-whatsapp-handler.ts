/**
 * conversation-router/handlers/mentoria-whatsapp-handler.ts
 *
 * NOT_IMPLEMENTED — stub handler for Mentoria SaaS.
 *
 * This handler is a placeholder. It will never be dispatched by the router
 * in the current routing scheme (all WhatsApp routes to campamento-base).
 *
 * To activate: wire this handler to real Mentoria domain logic
 * (src/lib/mentoria/service.ts, src/lib/mentoria/session-engine.ts, etc.)
 * and implement a saasId → platform type resolver in the router.
 */
import { registerHandler } from "../index";
import type { ConversationHandler, RouteResult } from "../types";

const HANDLER_ID = "mentoria";

const mentoriaWhatsappHandler: ConversationHandler = async (): Promise<RouteResult> => {
  return {
    handled: false,
    handler: HANDLER_ID,
    reply: null,
    error: "NOT_IMPLEMENTED",
  };
};

/**
 * Register the Mentoria WhatsApp stub with the router.
 * The handler will return NOT_IMPLEMENTED for all messages until
 * real Mentoria domain logic is connected.
 */
export function registerMentoriaWhatsappHandler(): void {
  registerHandler(HANDLER_ID, mentoriaWhatsappHandler);
}
