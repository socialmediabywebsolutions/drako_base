/**
 * conversation-router/campamento-base-handler.ts
 *
 * DEPRECATED: This file is maintained for backward compatibility.
 * The actual handler implementation has moved to:
 * ./handlers/campamento-base-whatsapp-handler.ts
 *
 * Please use the new handlers structure for all new integrations.
 */
import { registerCampamentoBaseWhatsappHandler } from "./handlers/campamento-base-whatsapp-handler";

/**
 * @deprecated Use registerCampamentoBaseWhatsappHandler from ./handlers/ instead
 * Register the Campamento Base handler with the router.
 * Call this once at app startup or in the service endpoint initialization.
 * Idempotent: safe to call multiple times.
 */
export function registerCampamentoBaseHandler(): void {
  registerCampamentoBaseWhatsappHandler();
}
