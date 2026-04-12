/**
 * conversation-router/handlers/index.ts
 *
 * Centralized registration for all WhatsApp SaaS handlers.
 * This provides a single point to bootstrap all available handlers
 * for the conversation router system.
 */
import { registerCampamentoBaseWhatsappHandler } from "./campamento-base-whatsapp-handler";
import { registerMentoriaWhatsappHandler } from "./mentoria-whatsapp-handler";
import { registerSocialflowWhatsappHandler } from "./socialflow-whatsapp-handler";

/**
 * Register all available WhatsApp handlers for all SaaS platforms.
 * Call this once at application startup to ensure all handlers are available.
 * 
 * This function is idempotent - safe to call multiple times.
 */
export function registerAllWhatsappHandlers(): void {
  registerCampamentoBaseWhatsappHandler();
  registerMentoriaWhatsappHandler();
  registerSocialflowWhatsappHandler();
}

// Re-export individual registration functions for selective registration
export { registerCampamentoBaseWhatsappHandler } from "./campamento-base-whatsapp-handler";
export { registerMentoriaWhatsappHandler } from "./mentoria-whatsapp-handler";
export { registerSocialflowWhatsappHandler } from "./socialflow-whatsapp-handler";
