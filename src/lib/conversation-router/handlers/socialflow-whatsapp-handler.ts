/**
 * conversation-router/handlers/socialflow-whatsapp-handler.ts
 *
 * Thin HTTP adapter for SocialFlow (Socialcors) WhatsApp domain logic.
 * Forwards the normalized turn to POST /api/socialflow/whatsapp/message,
 * which owns the actual profile lookup + AI reply generation.
 */
import { registerHandler } from "../index";
import type { ConversationHandler, RouteResult } from "../types";

const HANDLER_ID = "socialflow";

// Hardcoded deliberately: APP_URL in workers/socialflows/wrangler.workers.toml still
// points at socialflows.drako.systems (changing it risks breaking already-registered
// Instagram/Meta/LinkedIn OAuth redirect URIs). This endpoint call is internal
// server-to-server traffic, not OAuth, so it can target the canonical domain directly
// without touching APP_URL.
const SOCIALFLOW_WHATSAPP_MESSAGE_URL = "https://socialcors.com/api/socialflow/whatsapp/message";

const socialflowWhatsappHandler: ConversationHandler = async (route): Promise<RouteResult> => {
  const saasId = route.metadata?.saasId as string | undefined;
  if (!saasId) {
    return { handled: false, handler: HANDLER_ID, reply: null, error: "MISSING_SAAS_ID" };
  }

  try {
    const res = await fetch(SOCIALFLOW_WHATSAPP_MESSAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DRAKO_ROUTER_SECRET ?? ""}`,
      },
      body: JSON.stringify({
        tenantId: route.tenantId,
        saasId,
        phoneNumber: route.senderId,
        message: route.message,
        metadata: route.metadata ?? null,
      }),
    });

    if (!res.ok) {
      return { handled: false, handler: HANDLER_ID, reply: null, error: `SOCIALFLOW_WHATSAPP_HTTP_${res.status}` };
    }

    const data = (await res.json().catch(() => null)) as { reply?: string } | null;
    if (!data?.reply?.trim()) {
      return { handled: false, handler: HANDLER_ID, reply: null, error: "SOCIALFLOW_WHATSAPP_EMPTY_REPLY" };
    }

    return { handled: true, handler: HANDLER_ID, reply: data.reply };
  } catch (error) {
    return {
      handled: false,
      handler: HANDLER_ID,
      reply: null,
      error: error instanceof Error ? error.message : "SOCIALFLOW_WHATSAPP_FETCH_FAILED",
    };
  }
};

/**
 * Register the SocialFlow WhatsApp handler with the router.
 * Idempotent: safe to call multiple times.
 */
export function registerSocialflowWhatsappHandler(): void {
  registerHandler(HANDLER_ID, socialflowWhatsappHandler);
}
