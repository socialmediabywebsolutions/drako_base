/**
 * conversation-router/handlers/socialflow-whatsapp-handler.ts
 *
 * Thin HTTP adapter for SocialFlow (Socialcors) WhatsApp domain logic.
 * Forwards the normalized turn to POST /api/socialflow/whatsapp/message,
 * which owns the actual profile lookup + AI reply generation.
 */
import { env } from "@/lib/cf";
import { registerHandler } from "../index";
import type { ConversationHandler, RouteResult } from "../types";

const HANDLER_ID = "socialflow";

function resolveAppBaseUrl(): string | null {
  const url = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? env()?.APP_URL ?? null;
  return url ? url.replace(/\/$/, "") : null;
}

const socialflowWhatsappHandler: ConversationHandler = async (route): Promise<RouteResult> => {
  const saasId = route.metadata?.saasId as string | undefined;
  if (!saasId) {
    return { handled: false, handler: HANDLER_ID, reply: null, error: "MISSING_SAAS_ID" };
  }

  const baseUrl = resolveAppBaseUrl();
  if (!baseUrl) {
    return { handled: false, handler: HANDLER_ID, reply: null, error: "APP_URL_NOT_CONFIGURED" };
  }

  try {
    const res = await fetch(`${baseUrl}/api/socialflow/whatsapp/message`, {
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
